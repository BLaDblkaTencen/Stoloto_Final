// Если код карты не загрузился (нет сети, ошибка Leaflet) — показываем «Карта недоступна»,
// а не ломаем страницу: основной сценарий ТЗ от карты не зависит.
import { Component, Suspense, type ReactNode } from 'react';
import { MapUnavailable, Skeleton } from '../../../shared/ui';

type State = { failed: boolean; attempt: number };

class Boundary extends Component<{ children: ReactNode; className: string }, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className={`map-frame overflow-hidden ${this.props.className}`}>
          <MapUnavailable
            onRetry={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))}
          />
        </div>
      );
    }
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}

/** Обёртка ленивой карты: заглушка на время загрузки и запасное состояние при ошибке. */
export function MapBoundary({ className, children }: { className: string; children: ReactNode }) {
  return (
    <Boundary className={className}>
      <Suspense fallback={<Skeleton className={`w-full ${className}`} />}>{children}</Suspense>
    </Boundary>
  );
}
