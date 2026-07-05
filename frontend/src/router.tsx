import {
  QueryClient,
  QueryClientProvider,
  type DehydratedState,
  dehydrate,
  hydrate,
} from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  const serializeQueryClientState = (() => ({
    queryClientState: JSON.parse(
      JSON.stringify(dehydrate(queryClient, { shouldDehydrateMutation: () => false })),
    ) as DehydratedState,
  })) as () => any;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    dehydrate: serializeQueryClientState,
    hydrate: (dehydrated) => {
      hydrate(queryClient, dehydrated.queryClientState);
    },
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return router;
};
