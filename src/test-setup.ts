import "@testing-library/jest-dom/vitest";

// jsdom 不支持 scrollIntoView，mock 它避免测试报错
Element.prototype.scrollIntoView = vi.fn();
