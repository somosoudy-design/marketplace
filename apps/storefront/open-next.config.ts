import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// The storefront uses dynamic SSR. It needs no persistent ISR cache or paid storage.
export default defineCloudflareConfig();
