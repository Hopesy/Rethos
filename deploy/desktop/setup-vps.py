"""Per-computer SSH bridge setup; invoked by Setup-Desktop.ps1 over SSH."""
import base64
import fcntl
import json
import os
from pathlib import Path
import re
import shlex
import socket
import subprocess
import sys


def run(args, data=None, timeout=45):
    result = subprocess.run(args, input=data, text=True, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError('%s failed: %s' % (args[0], result.stderr[-1800:]))
    return result.stdout.strip()


def write(path, text, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp = path.with_name(path.name + '.new')
    fd = os.open(str(temp), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, mode)
    with os.fdopen(fd, 'w', encoding='utf-8') as stream:
        stream.write(text)
    os.chmod(temp, mode)
    temp.replace(path)


def edit_authorized(path, marker, line=None):
    lines = path.read_text().splitlines() if path.exists() else []
    lines = [s for s in lines if not s.endswith(' ' + marker)]
    if line:
        lines.append(line + ' ' + marker)
    write(path, '\n'.join(lines) + '\n')


def public_key(value):
    fields = value.strip().split()
    if len(fields) < 2 or fields[0] != 'ssh-ed25519' or not re.fullmatch(r'[A-Za-z0-9+/=]+', fields[1]):
        raise ValueError('Expected an ed25519 public key.')
    return ' '.join(fields[:2])


def allocate_port(root, device, requested):
    reserved = set()
    for file in root.glob('*/state.json'):
        if file.parent.name != device:
            reserved.add(json.loads(file.read_text())['reversePort'])
    ports = [int(requested)] if requested else range(22222, 23000)
    for port in ports:
        if not 1024 <= port <= 65535 or port in reserved:
            continue
        with socket.socket() as sock:
            try:
                sock.bind(('127.0.0.1', port))
            except OSError:
                continue
            return port
    raise RuntimeError('No free reverse port. Select another port and retry.')


def detect_container(requested):
    if requested == 'none':
        return None
    if requested:
        if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}', requested):
            raise ValueError('Invalid container name.')
        run(['docker', 'inspect', requested])
        return requested
    found = run(['docker', 'ps', '--filter', 'label=com.docker.compose.service=rethos', '--format', '{{.Names}}']).splitlines()
    if len(found) != 1:
        raise RuntimeError('Specify -Container with the Rethos container name; use none for a native VPS install.')
    return found[0]


def configure_container(state, folder, auth):
    container = state['container']
    base = '/data/.ssh/rethos-desktop/' + state['device']
    run(['docker', 'exec', container, 'mkdir', '-p', base])
    run(['docker', 'exec', container, 'chmod', '700', base])
    exists = subprocess.run(['docker', 'exec', container, 'test', '-f', base + '/bridge'], capture_output=True).returncode == 0
    if not exists:
        run(['docker', 'exec', container, 'ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', base + '/bridge'])
    bridge = public_key(run(['docker', 'exec', container, 'cat', base + '/bridge.pub']))
    proxy = str(folder / 'cua-proxy')
    edit_authorized(auth, 'rethos-desktop:' + state['device'] + ':bridge',
                    'restrict,command="%s" %s' % (shlex.quote(proxy).replace('"', '\\"'), bridge))
    details = json.loads(run(['docker', 'inspect', container]))[0]
    gateways = [net.get('Gateway') for net in details['NetworkSettings']['Networks'].values() if net.get('Gateway')]
    if not gateways:
        raise RuntimeError('The Rethos container needs a Docker bridge network.')
    host = gateways[0]
    host_key = public_key(Path('/etc/ssh/ssh_host_ed25519_key.pub').read_text())
    local_ssh_port = os.environ.get('SSH_CONNECTION', '0 0 0 22').split()[-1]
    config = ('Host rethos-bridge\n HostName %s\n Port %s\n User %s\n IdentityFile %s/bridge\n'
              ' HostKeyAlias rethos-vps\n UserKnownHostsFile %s/known_hosts\n'
              ' StrictHostKeyChecking yes\n IdentitiesOnly yes\n BatchMode yes\n ConnectTimeout 10\n') % (
                  host, local_ssh_port, state['vpsUser'], base, base)
    node_write = 'const fs=require("fs");fs.writeFileSync(process.argv[1],Buffer.from(process.argv[2],"base64"),{mode:0o600});'
    for name, content in [('config', config), ('known_hosts', 'rethos-vps ' + host_key + '\n')]:
        run(['docker', 'exec', container, 'node', '-e', node_write, base + '/' + name,
             base64.b64encode(content.encode()).decode()])
    state['containerDir'] = base
    state['mcp'] = {'command': 'ssh', 'args': ['-T', '-F', base + '/config', 'rethos-bridge'], 'enabled': True}


def prepare(request, root, folder, auth):
    state_path = folder / 'state.json'
    previous = json.loads(state_path.read_text()) if state_path.exists() else None
    if previous and previous['clientId'] != request['clientId']:
        raise RuntimeError('This computer name already belongs to another installation. Choose a different name.')
    container = detect_container(request.get('container'))
    port = previous['reversePort'] if previous else allocate_port(root, request['device'], request.get('reversePort'))
    if previous and request.get('reversePort') and int(request['reversePort']) != port:
        raise RuntimeError('An existing installation keeps its assigned port. Remove it before changing ports.')
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(folder, 0o700)
    key = folder / 'windows'
    if not key.exists():
        run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(key)])
    callback_key = public_key(key.with_suffix('.pub').read_text())
    host_key = public_key(request['windowsHostKey'])
    user = request['windowsUser']
    driver = request['driverPath']
    if any(c in user + driver for c in '\r\n\0') or not re.fullmatch(r'[A-Za-z]:\\.+\\cua-driver\.exe', driver):
        raise ValueError('Invalid Windows account or CUA path.')
    config = ('Host windows\n HostName 127.0.0.1\n Port %d\n User %s\n IdentityFile %s\n'
              ' HostKeyAlias rethos-windows\n UserKnownHostsFile %s\n StrictHostKeyChecking yes\n'
              ' IdentitiesOnly yes\n BatchMode yes\n ConnectTimeout 12\n ServerAliveInterval 15\n ServerAliveCountMax 3\n') % (
                  port, json.dumps(user, ensure_ascii=False), json.dumps(str(key), ensure_ascii=False), json.dumps(str(folder / 'known_hosts'), ensure_ascii=False))
    write(folder / 'ssh_config', config)
    write(folder / 'known_hosts', 'rethos-windows ' + host_key + '\n')
    write(folder / 'cua-proxy', '#!/bin/sh\nexec /usr/bin/ssh -T -F %s windows cua-mcp\n' % (
        shlex.quote(str(folder / 'ssh_config'))), 0o700)
    source = globals().get('BOOTSTRAP_SOURCE')
    if source:
        write(folder / 'setup-vps.py', source, 0o700)
    state = dict(device=request['device'], clientId=request['clientId'], reversePort=port,
                 windowsKey=callback_key, driverPath=driver, vpsUser=run(['id', '-un']),
                 container=container, mcpName='pc-' + request['device'])
    control = 'python3 %s --managed' % shlex.quote(str(folder / 'setup-vps.py'))
    edit_authorized(auth, 'rethos-desktop:' + request['device'] + ':tunnel',
                    'restrict,port-forwarding,permitlisten="127.0.0.1:%d",command="%s" %s' % (
                        port, control.replace('"', '\\"'), public_key(request['tunnelPublicKey'])))
    if container:
        configure_container(state, folder, auth)
    else:
        state['mcp'] = {'command': str(folder / 'cua-proxy'), 'args': [], 'enabled': True}
    write(state_path, json.dumps(state, indent=2) + '\n')
    return state


REGISTER_JS = r'''
const fs=require('fs');
const [tokenFile,tokenId,action,payload64]=process.argv.slice(1);
const payload=JSON.parse(Buffer.from(payload64,'base64'));
const token=fs.readFileSync(tokenFile,'utf8').trim();
const base='http://127.0.0.1:'+(process.env.OMB_PORT||8799);
async function api(path,method='GET',body) {
 const res=await fetch(base+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 const data=await res.json(); if(!res.ok) throw Error('Rethos '+res.status+': '+(data.error||'request failed')); return data;
}
(async()=>{try{
 const listed=await api('/api/mcp/servers');
 const old=listed.servers.find(s=>s.name===payload.name);
 if(old&&(old.command!==payload.command||JSON.stringify(old.args)!==JSON.stringify(payload.args))) throw Error('MCP name already belongs to another connection');
 if(action==='remove') { if(old) await api('/api/mcp/servers/'+payload.name,'DELETE'); console.log(JSON.stringify({removed:true})); }
 else {
  if(!old) await api('/api/mcp/servers','POST',payload);
  else if(!old.enabled) await api('/api/mcp/servers/'+payload.name,'PATCH',{enabled:true});
  const result=await api('/api/mcp/servers/'+payload.name+'/test','POST',{});
  if(result.ok===false||result.error) throw Error(result.error||'MCP connection test failed');
  console.log(JSON.stringify({registered:true,name:payload.name,tools:Array.isArray(result.tools)?result.tools.length:null}));
 }
}finally{try{await api('/api/auth/sessions/'+tokenId,'DELETE');}finally{fs.rmSync(tokenFile,{force:true});}}})().catch(e=>{console.error(e.message);process.exitCode=1;});
'''


def register_mcp(state, action):
    if not state['container']:
        return {'registered': False, 'manualImport': True}
    container = state['container']
    token_file = state['containerDir'] + '/setup-token'
    minted = json.loads(run(['docker', 'exec', container, 'rethos', 'token', 'create',
                             'Desktop setup ' + state['device'], '--scope', 'admin', '--expires', '1h',
                             '--out', token_file, '--force', '--json']))
    token_id = minted.get('token', {}).get('id') or minted.get('result', {}).get('token', {}).get('id')
    if not token_id:
        raise RuntimeError('Rethos returned an unsupported token response. See the generated MCP import file.')
    payload = dict(name=state['mcpName'], **state['mcp'])
    return json.loads(run(['docker', 'exec', container, 'node', '-e', REGISTER_JS, token_file,
                          token_id, action, base64.b64encode(json.dumps(payload).encode()).decode()], timeout=90))


def check(state, folder):
    version = run(['ssh', '-T', '-F', str(folder / 'ssh_config'), 'windows', 'cua-status'], timeout=35)
    if 'daemon is running' not in version:
        raise RuntimeError('Windows CUA is not running: ' + version)
    return {'connected': True, 'status': version}


def execute(request, home=None):
    device = request['device']
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,23}', device):
        raise ValueError('Computer name must start with a-z and use up to 24 lowercase letters, digits or hyphens.')
    root = Path(home or Path.home()) / '.rethos-desktop' / 'devices'
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    folder = root / device
    auth = Path(home or Path.home()) / '.ssh' / 'authorized_keys'
    auth.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (root.parent / 'setup.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if request['action'] == 'prepare':
            return prepare(request, root, folder, auth)
        state = json.loads((folder / 'state.json').read_text())
        if state['clientId'] != request['clientId']:
            raise RuntimeError('Installation identity mismatch.')
        if request['action'] == 'check':
            return check(state, folder)
        if request['action'] == 'register':
            check(state, folder)
            return register_mcp(state, 'register')
        if request['action'] == 'remove':
            register_mcp(state, 'remove')
            for kind in ('tunnel', 'bridge'):
                edit_authorized(auth, 'rethos-desktop:' + device + ':' + kind)
            state['removed'] = True
            write(folder / 'state.json', json.dumps(state, indent=2) + '\n')
            return {'removed': True, 'retainedBackup': str(folder)}
        raise ValueError('Unknown action.')


if __name__ == '__main__':
    try:
        managed = sys.argv[1] == '--managed'
        encoded = os.environ.get('SSH_ORIGINAL_COMMAND', '') if managed else sys.argv[1]
        request = json.loads(base64.b64decode(encoded, validate=True))
        if managed and (request['device'] != Path(__file__).parent.name or request['action'] not in ('check', 'register', 'remove')):
            raise ValueError('Unsupported managed request.')
        result = execute(request)
        print('RETHOS_SETUP_JSON=' + json.dumps({'ok': True, 'result': result}, ensure_ascii=True))
    except Exception as error:
        print('RETHOS_SETUP_JSON=' + json.dumps({'ok': False, 'error': str(error)}, ensure_ascii=True))
        sys.exit(1)
