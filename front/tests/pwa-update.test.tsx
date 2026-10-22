import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaUpdateNotice } from "@/components/pwa/PwaUpdateNotice";
import { saveGame } from "@/src/database/repositories/game-repository";
import { useGameStore } from "@/src/stores/game-store";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/src/database/repositories/game-repository", () => ({ saveGame: vi.fn().mockResolvedValue(undefined) }));

class Worker extends EventTarget {
  state = "installed";
  postMessage = vi.fn();
}
class Registration extends EventTarget {
  active: Worker | null = new Worker();
  waiting: Worker | null = null;
  installing: Worker | null = null;
  update = vi.fn().mockResolvedValue(undefined);
}
class Container extends EventTarget {
  controller: Worker | null = new Worker();
  ready: Promise<Registration>;
  constructor(registration: Registration) { super(); this.ready = Promise.resolve(registration); }
}

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
const initialStore = useGameStore.getState();
let registration: Registration;
let container: Container;
let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveGame).mockResolvedValue(undefined);
  navigation.pathname = "/";
  useGameStore.setState(initialStore);
  registration = new Registration();
  container = new Container(registration);
  reload = vi.fn();
  vi.stubGlobal("location", { reload });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalServiceWorker) Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  else Reflect.deleteProperty(navigator, "serviceWorker");
});

async function mountWaiting() {
  registration.waiting = new Worker();
  const result = render(<PwaUpdateNotice />);
  await screen.findByText("Nouvelle version disponible");
  return result;
}

function activate() {
  container.controller = registration.waiting ?? new Worker();
  registration.waiting = null;
  container.dispatchEvent(new Event("controllerchange"));
}

describe("mises à jour PWA", () => {
  it("ne propose pas de mise à jour lors de la première installation", async () => {
    container.controller = null;
    render(<PwaUpdateNotice />);
    await waitFor(() => expect(registration.update).toHaveBeenCalledOnce());
    act(activate);
    expect(screen.queryByText("Nouvelle version disponible")).not.toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it("détecte un nouveau worker installé et permet de reporter sans l’activer", async () => {
    render(<PwaUpdateNotice />);
    await waitFor(() => expect(registration.update).toHaveBeenCalledOnce());
    const worker = new Worker();
    registration.installing = worker;
    act(() => registration.dispatchEvent(new Event("updatefound")));
    registration.waiting = worker;
    act(() => worker.dispatchEvent(new Event("statechange")));
    expect(screen.getByText("Nouvelle version disponible")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Plus tard" }));
    expect(screen.queryByText("Nouvelle version disponible")).not.toBeInTheDocument();
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("sauvegarde la partie avant d’activer puis recharge une seule fois", async () => {
    useGameStore.setState({ hasStarted: true });
    let saved!: () => void;
    vi.mocked(saveGame).mockImplementationOnce(() => new Promise<void>(resolve => { saved = resolve; }));
    await mountWaiting();
    const worker = registration.waiting!;
    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    expect(saveGame).toHaveBeenCalledWith(useGameStore.getState().history.present);
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    await act(async () => saved());
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).not.toHaveBeenCalled();
    act(activate);
    act(() => container.dispatchEvent(new Event("controllerchange")));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("attend aussi la sauvegarde si un autre onglet active la mise à jour", async () => {
    useGameStore.setState({ hasStarted: true });
    let saved!: () => void;
    vi.mocked(saveGame).mockImplementationOnce(() => new Promise<void>(resolve => { saved = resolve; }));
    await mountWaiting();
    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    act(activate);
    expect(reload).not.toHaveBeenCalled();
    await act(async () => saved());
    expect(reload).toHaveBeenCalledOnce();
  });

  it("ne recharge pas un autre onglet sans son accord", async () => {
    render(<PwaUpdateNotice />);
    await waitFor(() => expect(registration.update).toHaveBeenCalledOnce());
    act(activate);
    expect(screen.getByText("Nouvelle version disponible")).toBeVisible();
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
  });

  it("reporte le message pendant le jeu, même pendant la restauration", async () => {
    navigation.pathname = "/game";
    registration.waiting = new Worker();
    const view = render(<PwaUpdateNotice />);
    await waitFor(() => expect(registration.update).toHaveBeenCalledOnce());
    expect(screen.queryByText("Nouvelle version disponible")).not.toBeInTheDocument();
    act(() => useGameStore.setState({ hasStarted: true }));
    expect(screen.queryByText("Nouvelle version disponible")).not.toBeInTheDocument();
    act(activate);
    expect(reload).not.toHaveBeenCalled();
    navigation.pathname = "/";
    view.rerender(<PwaUpdateNotice />);
    expect(screen.getByText("Nouvelle version disponible")).toBeVisible();
  });

  it("affiche le message à la fin de la partie", async () => {
    navigation.pathname = "/game";
    useGameStore.setState({ hasStarted: true, history: { ...initialStore.history, present: { ...initialStore.history.present, status: "completed" } } });
    await mountWaiting();
    expect(screen.getByRole("button", { name: "Actualiser" })).toBeEnabled();
  });

  it("ne recharge pas au retour de connexion et bloque l’actualisation hors ligne", async () => {
    await mountWaiting();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.getByRole("button", { name: "Actualiser" })).toBeDisabled();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    act(() => window.dispatchEvent(new Event("online")));
    expect(screen.getByRole("button", { name: "Actualiser" })).toBeEnabled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("conserve l’ancienne version si la sauvegarde échoue et permet de réessayer", async () => {
    useGameStore.setState({ hasStarted: true });
    vi.mocked(saveGame).mockRejectedValueOnce(new Error("Storage full"));
    await mountWaiting();
    const worker = registration.waiting!;
    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    await screen.findByRole("alert");
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    await waitFor(() => expect(worker.postMessage).toHaveBeenCalledOnce());
  });

  it("permet de réessayer si l’activation du worker ne répond pas", async () => {
    await mountWaiting();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    act(() => vi.advanceTimersByTime(15_000));
    expect(screen.getByRole("alert")).toHaveTextContent("Tu peux réessayer");
    expect(screen.getByRole("button", { name: "Actualiser" })).toBeEnabled();
    act(activate);
    expect(reload).not.toHaveBeenCalled();
  });

  it("vérifie périodiquement et au retour sur l’application sans requêtes répétées", async () => {
    vi.useFakeTimers();
    await act(async () => { render(<PwaUpdateNotice />); });
    expect(registration.update).toHaveBeenCalledOnce();
    await act(async () => { vi.advanceTimersByTime(5 * 60_000); });
    expect(registration.update).toHaveBeenCalledTimes(2);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(registration.update).toHaveBeenCalledTimes(2);
    await act(async () => { vi.advanceTimersByTime(60_000); window.dispatchEvent(new Event("focus")); });
    expect(registration.update).toHaveBeenCalledTimes(3);
  });

  it("reste discret si les workers sont indisponibles ou le réseau échoue", async () => {
    registration.update.mockRejectedValue(new Error("Offline"));
    const view = render(<PwaUpdateNotice />);
    await waitFor(() => expect(registration.update).toHaveBeenCalledOnce());
    view.unmount();
    Reflect.deleteProperty(navigator, "serviceWorker");
    render(<PwaUpdateNotice />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
