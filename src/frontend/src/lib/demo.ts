// Demo mode shows one-tap sign-in buttons for the seeded demo accounts.
// It is on for local development and for deployments built with NEXT_PUBLIC_DEMO_MODE=true,
// and off in production builds so real users never see demo credentials.
export const isDemoMode =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV === 'development';
