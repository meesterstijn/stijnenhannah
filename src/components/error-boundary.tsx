import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-6 text-center">
          <p className="text-muted-foreground text-sm">Er ging iets mis bij het laden van deze pagina.</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="text-sm underline text-muted-foreground hover:text-foreground"
          >
            Probeer opnieuw
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
