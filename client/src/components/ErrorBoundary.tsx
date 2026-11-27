import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="mb-3 text-5xl">⚠️</div>
          <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
          <p className="mt-2 text-sm text-slate-500">{this.state.error.message}</p>
          <button className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => location.reload()}>
            Обновить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
