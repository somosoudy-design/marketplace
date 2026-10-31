// Copied ONLY into .local/ios-personal/src/lib/push.ts. No APNs requests or token writes.
export async function pushAllowed(): Promise<boolean> {
  return false;
}

export async function registerForPush(options: { ask?: boolean } = {}): Promise<string> {
  void options;
  return 'Los avisos push de iOS requieren Apple Developer de pago. Los avisos dentro de la app siguen disponibles.';
}

export async function unregisterPush(): Promise<void> {
  // This local build never registers a remote token.
}
