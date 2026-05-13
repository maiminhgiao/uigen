import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Home from "../page";

// Mock các server actions
vi.mock("@/actions", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

// Mock redirect của Next.js — Next.js thực tế throw error để dừng execution,
// nên mock cần throw để tránh code chạy tiếp sau lời gọi redirect()
vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

// Mock MainContent để tránh render toàn bộ UI phức tạp
vi.mock("../main-content", () => ({
  MainContent: ({ user }: { user: any }) => (
    <div data-testid="main-content" data-user={user ? user.id : "anonymous"}>
      Main Content
    </div>
  ),
}));

import { getUser } from "@/actions";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { redirect } from "next/navigation";

// Dữ liệu mẫu dùng chung
const mockUser = { id: "user-1", email: "test@example.com", createdAt: new Date() };
const mockProject = {
  id: "project-1",
  name: "Test Project",
  userId: "user-1",
  messages: "[]",
  data: "{}",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// =====================
// Happy path
// =====================

test("hiển thị MainContent với user=null khi chưa đăng nhập", async () => {
  // Người dùng ẩn danh → getUser trả về null
  (getUser as any).mockResolvedValue(null);

  const ui = await Home();
  render(ui);

  const mainContent = screen.getByTestId("main-content");
  expect(mainContent).toBeDefined();
  // Không redirect khi chưa đăng nhập
  expect(redirect).not.toHaveBeenCalled();
});

test("truyền user=null vào MainContent khi chưa đăng nhập", async () => {
  (getUser as any).mockResolvedValue(null);

  const ui = await Home();
  render(ui);

  const mainContent = screen.getByTestId("main-content");
  // data-user="anonymous" vì user là null
  expect(mainContent.getAttribute("data-user")).toBe("anonymous");
});

test("redirect đến project đầu tiên khi user đã đăng nhập và có project", async () => {
  (getUser as any).mockResolvedValue(mockUser);
  (getProjects as any).mockResolvedValue([mockProject, { ...mockProject, id: "project-2" }]);

  // redirect() throw error → Home() sẽ reject
  await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/project-1");
  expect(createProject).not.toHaveBeenCalled();
});

test("tạo project mới rồi redirect khi user đăng nhập nhưng chưa có project", async () => {
  (getUser as any).mockResolvedValue(mockUser);
  (getProjects as any).mockResolvedValue([]);
  (createProject as any).mockResolvedValue(mockProject);

  // redirect() throw error → Home() sẽ reject
  await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/project-1");
  expect(createProject).toHaveBeenCalledOnce();
});

test("tên project mới được tạo có dạng 'New Design #XXXXX'", async () => {
  (getUser as any).mockResolvedValue(mockUser);
  (getProjects as any).mockResolvedValue([]);
  (createProject as any).mockResolvedValue(mockProject);

  await expect(Home()).rejects.toThrow("NEXT_REDIRECT");

  const callArgs = (createProject as any).mock.calls[0][0];
  expect(callArgs.name).toMatch(/^New Design #\d+$/);
  expect(callArgs.messages).toEqual([]);
  expect(callArgs.data).toEqual({});
});

// =====================
// Edge cases
// =====================

test("redirect đến project đầu tiên trong danh sách (đã sắp xếp theo updatedAt mới nhất)", async () => {
  const projects = [
    { ...mockProject, id: "project-newest" },
    { ...mockProject, id: "project-older" },
  ];
  (getUser as any).mockResolvedValue(mockUser);
  (getProjects as any).mockResolvedValue(projects);

  // Luôn lấy projects[0] — được sắp xếp bởi server action
  await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/project-newest");
});

test("không gọi getProjects khi user là null", async () => {
  (getUser as any).mockResolvedValue(null);

  await Home();

  expect(getProjects).not.toHaveBeenCalled();
});

test("không gọi createProject khi đã có ít nhất 1 project", async () => {
  (getUser as any).mockResolvedValue(mockUser);
  (getProjects as any).mockResolvedValue([mockProject]);

  await expect(Home()).rejects.toThrow("NEXT_REDIRECT");
  expect(createProject).not.toHaveBeenCalled();
});

// =====================
// Error states
// =====================

test("ném lỗi khi getUser thất bại", async () => {
  (getUser as any).mockRejectedValue(new Error("Database connection failed"));

  await expect(Home()).rejects.toThrow("Database connection failed");
});

test("ném lỗi khi getProjects thất bại sau khi đăng nhập", async () => {
  (getUser as any).mockResolvedValue(mockUser);
  (getProjects as any).mockRejectedValue(new Error("Unauthorized"));

  await expect(Home()).rejects.toThrow("Unauthorized");
});

test("ném lỗi khi createProject thất bại", async () => {
  (getUser as any).mockResolvedValue(mockUser);
  (getProjects as any).mockResolvedValue([]);
  (createProject as any).mockRejectedValue(new Error("Failed to create project"));

  await expect(Home()).rejects.toThrow("Failed to create project");
});
