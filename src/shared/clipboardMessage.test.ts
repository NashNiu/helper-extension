import { describe, expect, it } from "vitest";
import { hostnameOf, makeTextItem, makeImageItem } from "./clipboardMessage";

describe("hostnameOf", () => {
  it("extracts hostname", () => {
    expect(hostnameOf("https://github.com/x/y")).toBe("github.com");
  });
  it("returns empty string on invalid url", () => {
    expect(hostnameOf("not a url")).toBe("");
  });
});

describe("item builders", () => {
  it("makeTextItem assembles a non-pinned text item", () => {
    const it = makeTextItem({ text: "hi", source: "manual", id: "1", createdAt: 5 });
    expect(it).toEqual({ id: "1", type: "text", text: "hi", source: "manual", createdAt: 5, pinned: false });
  });
  it("makeImageItem assembles a non-pinned image item", () => {
    const it = makeImageItem({ dataUrl: "data:image/png;base64,AA", bytes: 2, w: 4, h: 6, source: "image", id: "2", createdAt: 7 });
    expect(it).toEqual({ id: "2", type: "image", dataUrl: "data:image/png;base64,AA", bytes: 2, w: 4, h: 6, source: "image", createdAt: 7, pinned: false });
  });
});
