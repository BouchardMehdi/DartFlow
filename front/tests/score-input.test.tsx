import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoreInput } from "@/components/game/ScoreInput";
import { Dartboard } from "@/components/dartboard/Dartboard";

afterEach(cleanup);

describe("saisie des fléchettes", () => {
  it("saisit les multiplicateurs et revient au simple après chaque lancer", () => {
    const onThrow = vi.fn();
    render(<ScoreInput onThrow={onThrow} disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Triple" }));
    fireEvent.click(screen.getByRole("button", { name: "Triple 20" }));
    expect(onThrow).toHaveBeenLastCalledWith(expect.objectContaining({ score: 60, multiplier: 3, zone: "triple" }));
    fireEvent.click(screen.getByRole("button", { name: "Simple 5" }));
    expect(onThrow).toHaveBeenLastCalledWith(expect.objectContaining({ score: 5, multiplier: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "Bull · 25" }));
    expect(onThrow).toHaveBeenLastCalledWith(expect.objectContaining({ score: 25, zone: "outer-bull" }));
    fireEvent.click(screen.getByRole("button", { name: "Bull · 50" }));
    expect(onThrow).toHaveBeenLastCalledWith(expect.objectContaining({ score: 50, zone: "inner-bull" }));
  });

  it("désactive les touches à la fin d'une partie", () => {
    render(<ScoreInput onThrow={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "Simple 20" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bull · 50" })).toBeDisabled();
  });

  it("attend le clic pour enregistrer un lancer sur la cible", () => {
    const onThrow = vi.fn();
    render(<Dartboard onThrow={onThrow} />);
    const triple = screen.getByRole("button", { name: "Triple 20, 60 points" });
    fireEvent.pointerDown(triple);
    expect(onThrow).not.toHaveBeenCalled();
    fireEvent.click(triple);
    expect(onThrow).toHaveBeenCalledTimes(1);
    expect(onThrow).toHaveBeenCalledWith(expect.objectContaining({ score: 60 }));
  });

  it("permet d'activer les deux bulls au clavier", () => {
    const onThrow = vi.fn();
    render(<Dartboard onThrow={onThrow} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Double bull, 50 points" }), { key: "Enter" });
    expect(onThrow).toHaveBeenLastCalledWith(expect.objectContaining({ score: 50 }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Bull extérieur, 25 points" }), { key: " " });
    expect(onThrow).toHaveBeenLastCalledWith(expect.objectContaining({ score: 25 }));
  });
});
