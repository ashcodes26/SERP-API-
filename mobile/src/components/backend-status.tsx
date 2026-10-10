import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { api, ApiError } from '@/api/client';
import { API_BASE_URL } from '@/config';
import { Spacing } from '@/constants/theme';
import type { HealthOut } from '@/types/contracts';

/** Live backend connectivity check: loading, success, and error-with-retry states. */
export function BackendStatus() {
  const [health, setHealth] = useState<HealthOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => {
        if (cancelled) return;
        setHealth(h);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setHealth(null);
        setError(e instanceof ApiError ? e.message : 'Unexpected error.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Backend</ThemedText>
      {loading && <ActivityIndicator />}
      {health && (
        <ThemedText type="small">
          {`${health.status} · v${health.version} · db ${health.database} · SerpApi ${health.serpapi_configured ? 'configured' : 'not configured'}`}
        </ThemedText>
      )}
      {error && (
        <>
          <ThemedText type="small">{error}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{API_BASE_URL}</ThemedText>
        </>
      )}
      <Pressable onPress={retry} accessibilityRole="button" disabled={loading}>
        <ThemedText type="linkPrimary">Retry</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three },
});
