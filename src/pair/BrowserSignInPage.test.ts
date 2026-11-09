import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { BrowserSignInPage } from "./BrowserSignInPage";

const credential = `omb_pair_${"c".repeat(43)}`;

it("shows the server and one sign-in action without revealing the QR credential", () => {
  const html = renderToStaticMarkup(createElement(BrowserSignInPage, { credential, owner: "ada@example.test" }));
  expect(html).toContain("ada@example.test");
  expect(html).toContain("Confirm the server below");
  expect(html.match(/class="login-submit/g)).toHaveLength(1);
  expect(html).toContain("Sign in</button>");
  expect(html).not.toContain(credential);
  expect(html).not.toContain("omb_pair_");
  expect(html).not.toMatch(/<input|<form|role="alert"/);
});
