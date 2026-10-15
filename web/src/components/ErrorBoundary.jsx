/**
 * ErrorBoundary.jsx
 *
 * Wraps each lazy-loaded screen in App.jsx. Catches two distinct
 * failure modes the same way: a render-time error thrown by the
 * screen itself, AND a failed dynamic import() (a lazy chunk that
 * couldn't be fetched -- a stale deploy, a flaky connection) -- React
 * surfaces a rejected lazy() promise as a thrown error during Suspense
 * resolution, which an ErrorBoundary catches exactly like any other.
 * Without this, either failure mode white-screens the whole app with
 * no recovery path. Must be a class component -- there is still no
 * hook equivalent of componentDidCatch/getDerivedStateFromError.
 */
import { Component } from 'react';
import { Button } from './Button.jsx';
import styles from './ErrorBoundary.module.css';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Anomaly Hunt: screen crashed', error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.wrap}>
        <div className={styles.panel}>
          <span className={styles.flag} />
          <h2 className={styles.title}>This screen hit a snag.</h2>
          <p className={styles.message}>
            Something didn't load right -- a bad case, a dropped connection, or just a bug. Your saved profile and
            match log live separately and weren't touched.
          </p>
          <Button variant="primary" onClick={this.handleReset}>
            Back to home
          </Button>
        </div>
      </div>
    );
  }
}
