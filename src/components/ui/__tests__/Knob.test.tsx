import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Knob, { type KnobProps } from "../Knob";

vi.mock("framer-motion", () => import("@/__mocks__/framer-motion"));

// jsdom에 setPointerCapture/releasePointerCapture가 없으므로 polyfill
beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

type RenderKnobOverrides = Omit<Partial<KnobProps>, "onChange">;

describe("Knob", () => {
  const defaultProps = {
    value: 50,
    min: 0,
    max: 100,
    onChange: vi.fn(),
    label: "Test Knob",
  };

  function renderKnob(overrides: RenderKnobOverrides = {}) {
    const props = { ...defaultProps, onChange: vi.fn(), ...overrides };
    render(<Knob {...props} />);
    return props;
  }

  // ── ARIA 속성 ──

  describe("접근성 (ARIA)", () => {
    it("role=slider로 렌더링된다", () => {
      renderKnob();
      expect(screen.getByRole("slider")).toBeInTheDocument();
    });

    it("aria-label이 label prop과 일치한다", () => {
      renderKnob({ label: "Cutoff" });
      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-label",
        "Cutoff",
      );
    });

    it("aria-valuemin/max/now가 올바르다", () => {
      renderKnob({ min: 20, max: 20000, value: 1000 });

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("aria-valuemin", "20");
      expect(slider).toHaveAttribute("aria-valuemax", "20000");
      expect(slider).toHaveAttribute("aria-valuenow", "1000");
    });

    it("tabIndex=0으로 포커스 가능하다", () => {
      renderKnob();
      expect(screen.getByRole("slider")).toHaveAttribute("tabindex", "0");
    });
  });

  // ── 값 표시 ──

  describe("값 표시", () => {
    it("formatValue가 없으면 기본 포맷(소수점 2자리)으로 표시된다", () => {
      renderKnob({ value: 0.75 });
      expect(screen.getByText("0.75")).toBeInTheDocument();
    });

    it("formatValue가 있으면 커스텀 포맷으로 표시된다", () => {
      renderKnob({
        value: 1500,
        formatValue: (v) => `${(v / 1000).toFixed(1)}k`,
      });
      expect(screen.getByText("1.5k")).toBeInTheDocument();
    });

    it("logarithmic 모드에서 formatValue가 없으면 정수로 표시된다", () => {
      renderKnob({ value: 440, logarithmic: true });
      expect(screen.getByText("440")).toBeInTheDocument();
    });

    it("라벨이 표시된다", () => {
      renderKnob({ label: "FREQ" });
      expect(screen.getByText("FREQ")).toBeInTheDocument();
    });
  });

  // ── 드래그 인터랙션 ──

  describe("드래그 인터랙션", () => {
    it("위로 드래그하면 onChange가 증가된 값으로 호출된다", () => {
      const props = renderKnob({ value: 50, min: 0, max: 100 });

      const slider = screen.getByRole("slider");

      // pointerDown → pointerMove(위로) 시뮬레이션
      fireEvent.pointerDown(slider, { clientY: 200 });
      fireEvent.pointerMove(slider, { clientY: 100, buttons: 1 });

      // 위로 100px 드래그 = 100/200 = 0.5 → normalized += 0.5
      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      expect(calledValue).toBeGreaterThan(50);
    });

    it("아래로 드래그하면 onChange가 감소된 값으로 호출된다", () => {
      const props = renderKnob({ value: 50, min: 0, max: 100 });

      const slider = screen.getByRole("slider");

      fireEvent.pointerDown(slider, { clientY: 200 });
      fireEvent.pointerMove(slider, { clientY: 300, buttons: 1 });

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      expect(calledValue).toBeLessThan(50);
    });

    it("드래그 결과가 min 아래로 내려가지 않는다 (클램핑)", () => {
      const props = renderKnob({ value: 10, min: 0, max: 100 });

      const slider = screen.getByRole("slider");

      // 매우 아래로 드래그 → normalized < 0 → 0으로 클램핑
      fireEvent.pointerDown(slider, { clientY: 200 });
      fireEvent.pointerMove(slider, { clientY: 600, buttons: 1 });

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      expect(calledValue).toBeGreaterThanOrEqual(0);
    });

    it("드래그 결과가 max 위로 올라가지 않는다 (클램핑)", () => {
      const props = renderKnob({ value: 90, min: 0, max: 100 });

      const slider = screen.getByRole("slider");

      // 매우 위로 드래그 → normalized > 1 → 1로 클램핑
      fireEvent.pointerDown(slider, { clientY: 200 });
      fireEvent.pointerMove(slider, { clientY: -200, buttons: 1 });

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      expect(calledValue).toBeLessThanOrEqual(100);
    });

    it("buttons=0이면 (드래그 안 함) onChange가 호출되지 않는다", () => {
      const props = renderKnob({ value: 50 });

      const slider = screen.getByRole("slider");

      fireEvent.pointerMove(slider, { clientY: 100, buttons: 0 });

      expect(props.onChange).not.toHaveBeenCalled();
    });
  });

  // ── 키보드 인터랙션 ──

  describe("키보드 인터랙션", () => {
    it("ArrowUp으로 1% 증가한다", async () => {
      const props = renderKnob({ value: 50, min: 0, max: 100 });

      const slider = screen.getByRole("slider");
      slider.focus();
      await userEvent.keyboard("{ArrowUp}");

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      // normalized 0.5 + 0.01 = 0.51 → value = 51
      expect(calledValue).toBeCloseTo(51, 0);
    });

    it("ArrowDown으로 1% 감소한다", async () => {
      const props = renderKnob({ value: 50, min: 0, max: 100 });

      const slider = screen.getByRole("slider");
      slider.focus();
      await userEvent.keyboard("{ArrowDown}");

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      expect(calledValue).toBeCloseTo(49, 0);
    });

    it("Shift+ArrowUp으로 10% 증가한다", async () => {
      const props = renderKnob({ value: 50, min: 0, max: 100 });

      const slider = screen.getByRole("slider");
      slider.focus();
      await userEvent.keyboard("{Shift>}{ArrowUp}{/Shift}");

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      // normalized 0.5 + 0.1 = 0.6 → value = 60
      expect(calledValue).toBeCloseTo(60, 0);
    });

    it("Shift+ArrowDown으로 10% 감소한다", async () => {
      const props = renderKnob({ value: 50, min: 0, max: 100 });

      const slider = screen.getByRole("slider");
      slider.focus();
      await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      expect(calledValue).toBeCloseTo(40, 0);
    });

    it("ArrowRight가 ArrowUp과 동일하게 동작한다", async () => {
      const props = renderKnob({ value: 50, min: 0, max: 100 });

      const slider = screen.getByRole("slider");
      slider.focus();
      await userEvent.keyboard("{ArrowRight}");

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      expect(calledValue).toBeCloseTo(51, 0);
    });

    it("키보드로 min 이하로 내려가지 않는다", async () => {
      const props = renderKnob({ value: 0, min: 0, max: 100 });

      const slider = screen.getByRole("slider");
      slider.focus();
      await userEvent.keyboard("{ArrowDown}");

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      expect(calledValue).toBeGreaterThanOrEqual(0);
    });

    it("키보드로 max 이상으로 올라가지 않는다", async () => {
      const props = renderKnob({ value: 100, min: 0, max: 100 });

      const slider = screen.getByRole("slider");
      slider.focus();
      await userEvent.keyboard("{ArrowUp}");

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      expect(calledValue).toBeLessThanOrEqual(100);
    });
  });

  // ── 로그 스케일 ──

  describe("로그 스케일", () => {
    it("logarithmic 모드에서 중간 드래그가 기하 중앙값 근처를 반환한다", () => {
      // min=0, max=20000, logarithmic → effectiveMin=20 (LOG_FLOOR)
      // normalized=0.5 → exp(log(20) + 0.5*(log(20000)-log(20))) ≈ 632Hz
      const props = renderKnob({
        value: 0,
        min: 0,
        max: 20000,
        logarithmic: true,
      });

      const slider = screen.getByRole("slider");

      // value=0일 때 normalized=0. 위로 100px 드래그 → delta=100/200=0.5
      fireEvent.pointerDown(slider, { clientY: 200 });
      fireEvent.pointerMove(slider, { clientY: 100, buttons: 1 });

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      // 로그 중앙: exp(log(20) + 0.5*(log(20000)-log(20))) ≈ 632
      expect(calledValue).toBeGreaterThan(500);
      expect(calledValue).toBeLessThan(800);
    });

    it("logarithmic 모드에서 normalized=0이면 min 값을 반환한다", () => {
      const props = renderKnob({
        value: 20,
        min: 0,
        max: 20000,
        logarithmic: true,
      });

      const slider = screen.getByRole("slider");

      // 충분히 아래로 드래그하여 normalized=0 도달
      fireEvent.pointerDown(slider, { clientY: 200 });
      fireEvent.pointerMove(slider, { clientY: 600, buttons: 1 });

      expect(props.onChange).toHaveBeenCalled();
      const calledValue = props.onChange.mock.calls[0][0];
      expect(calledValue).toBe(0); // min=0
    });

    it("logarithmic 모드에서 min값이면 노브가 왼쪽 끝(아크 없음), max값이면 오른쪽 끝(풀 아크)이어야 한다", () => {
      // Q 노브 범위: min=0.1, max=18, logarithmic=true
      const { rerender } = render(
        <Knob
          value={0.1}
          min={0.1}
          max={18}
          onChange={vi.fn()}
          label="Q"
          logarithmic
        />,
      );

      const slider = screen.getByRole("slider");

      // min값(0.1)일 때 — 아크가 없어야 함 (normalized=0 → valuePath=null)
      const svgPaths = slider.querySelectorAll("path");
      const arcPaths = Array.from(svgPaths).filter(
        (p) => p.getAttribute("stroke-linecap") === "round",
      );
      // 트랙 아크(배경)만 존재하고, 값 아크(채워진 부분)는 없어야 함
      expect(arcPaths.length).toBe(1);

      // max값(18)으로 변경 — 풀 아크가 렌더링되어야 함
      rerender(
        <Knob
          value={18}
          min={0.1}
          max={18}
          onChange={vi.fn()}
          label="Q"
          logarithmic
        />,
      );

      const arcPathsAfter = Array.from(slider.querySelectorAll("path")).filter(
        (p) => p.getAttribute("stroke-linecap") === "round",
      );
      // 트랙 아크 + 값 아크 = 2개
      expect(arcPathsAfter.length).toBe(2);
    });

    it("logarithmic 모드에서 중간값이면 노브가 중간 위치에 있어야 한다", () => {
      // Q=4일 때 normalized ≈ 0.72 → 아크가 존재해야 함
      render(
        <Knob
          value={4}
          min={0.1}
          max={18}
          onChange={vi.fn()}
          label="Q"
          logarithmic
        />,
      );

      const slider = screen.getByRole("slider");
      const arcPaths = Array.from(slider.querySelectorAll("path")).filter(
        (p) => p.getAttribute("stroke-linecap") === "round",
      );
      // 트랙 아크 + 값 아크 = 2개 (값이 min보다 크므로 아크가 렌더링됨)
      expect(arcPaths.length).toBe(2);
    });
  });
});
