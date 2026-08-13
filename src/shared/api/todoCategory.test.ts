import { describe, expect, it } from "vitest";
import { isNameTakenError } from "./todoCategory";
import { CategoryNameTakenError } from "../local/todoCategories";
import { ApiError } from "../http";

// 重名在两条路径上长得完全不一样:后端回 409,本地抛自定义错误。
// UI 只想知道「是不是撞名了」,这个判定把两者收敛成一个问题。
describe("isNameTakenError", () => {
  it("本地的重名错误", () => {
    expect(isNameTakenError(new CategoryNameTakenError("工作"))).toBe(true);
  });

  it("后端的 409", () => {
    expect(isNameTakenError(new ApiError("already exists", 409))).toBe(true);
  });

  it("其它 ApiError 不算重名", () => {
    expect(isNameTakenError(new ApiError("boom", 500))).toBe(false);
    expect(isNameTakenError(new ApiError("网络请求失败", 0))).toBe(false);
  });

  it("普通错误不算重名", () => {
    expect(isNameTakenError(new Error("分类名不能为空"))).toBe(false);
    expect(isNameTakenError(undefined)).toBe(false);
  });
});
