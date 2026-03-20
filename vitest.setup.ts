import "@testing-library/jest-dom/vitest";

// jsdom의 File/Blob에 arrayBuffer() 메서드가 없으므로 polyfill 추가
if (typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(this);
    });
  };
}
