import { describe, expect, it } from "vitest";

import { hasSetupChoices, initialGreeting, initialGreetingMessage, setupChoices, setupRequestLine } from "./initial-greeting.ts";

describe("the line after Set me up", () => {
  it("is written in the app's language, by region, with English for any other", () => {
    expect(setupRequestLine("en")).toBe(
      "Great. Tell me what you'd like help with, in your own words, and I'll set myself up for it. For example: \"sort my inbox every morning\" or \"research our competitors every week\".",
    );
    expect(setupRequestLine("es-MX")).toMatch(/^Genial\. Cuéntame/);
    expect(setupRequestLine("pt-BR")).toMatch(/^Ótimo\. Me conte/);
    expect(setupRequestLine("fr")).toBe(setupRequestLine("en"));
    expect(setupRequestLine(undefined)).toBe(setupRequestLine("en"));
  });

  it("leaves the greeting itself as it was", () => {
    expect(initialGreeting("Ava", "en")).toBe("Hi, I'm Ava. What would you like me to do?");
  });
});

describe("a new bot's greeting", () => {
  it.each(["zh", "zh-CN", "zh-Hans", "zh-SG"])("writes the whole initial setup in Simplified Chinese for %s while preserving the bot name", (language) => {
    expect(initialGreeting("Scout", language)).toBe("你好，我是 Scout。有什么需要我帮忙的？");
    expect(initialGreeting("Scout", language, "王小明")).toBe("你好，王小明，我是 Scout。有什么需要我帮忙的？");
    expect(hasSetupChoices(language)).toBe(true);
    expect(setupChoices(language)).toEqual(["资料研究与深入分析", "持续关注任务进展", "邮件、日历与消息", "预订、购物与日常事务", "数据、表格与报告"]);
    expect(setupRequestLine(language)).toMatch(/^好的，告诉我你希望我帮你做什么/);
    expect(initialGreetingMessage("Scout", () => language, true)).toMatchObject({ text: initialGreeting("Scout", language), setupOffer: true, setupChoices: setupChoices(language) });
  });
  it("names the person by their first name, in the app's language", () => {
    expect(initialGreeting("Scout", "en", "Milind Soni")).toBe("Hi Milind, I'm Scout. What would you like me to do?");
    expect(initialGreeting("Scout", "es-MX", "  Ana  María ")).toBe("Hola Ana, soy Scout. ¿Qué te gustaría que hiciera?");
    expect(initialGreeting("Scout", "pt-BR", "João")).toBe("Oi João, eu sou Scout. O que você gostaria que eu fizesse?");
    expect(initialGreeting("Scout", "zh-TW", "王小明")).toBe("嗨 王小明，我是 Scout。你想要我幫你做什麼？");
    expect(initialGreeting("Scout", "zh-Hant")).toBe("嗨，我是 Scout。你想要我幫你做什麼？");
  });

  it("names no one when the person has not given a name", () => {
    for (const person of [undefined, "", "   "]) {
      expect(initialGreeting("Scout", "en", person)).toBe("Hi, I'm Scout. What would you like me to do?");
    }
  });
});
