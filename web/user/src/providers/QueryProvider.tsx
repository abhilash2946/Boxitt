import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

// Create a single queryClient instance with automatic window focus revalidation and no stale cache trapping
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Always consider data stale so revalidation checks for updates
      gcTime: 1000 * 60 * 5, // Keep unused query data in memory for 5 minutes for snappy UI transitions
      refetchOnWindowFocus: true, // ALWAYS refetch fresh data when window or tab regains focus
      refetchOnMount: true, // Always refetch when navigating to a page
      refetchOnReconnect: true, // Refetch when network connection is restored
      retry: 1, // Retry failed requests once
    },
    mutations: {
      retry: 1,
    }
  }
});

export function AppQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
