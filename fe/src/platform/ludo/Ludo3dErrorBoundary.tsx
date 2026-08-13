import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (err: Error) => void;
};

type State = { error: Error | null };

/** Catches R3F / WebGL / chunk load failures so Ludo can fall back to 2D. */
export class Ludo3dErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[ludo-3d]", error.message, info.componentStack);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}
