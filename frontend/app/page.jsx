import LandingClient from "./LandingClient";

export const metadata = {
  title: "Claim Your Australian Super Refund (DASP)",
  description:
    "Left Australia? Estimate and claim your Australian Super refund (DASP) in under 3 minutes. Free estimate for backpackers, working holiday makers and international students. Up to 65% back.",
  keywords:
    "australian super refund, super back australia, DASP, working holiday super refund, student visa super, backpacker tax refund australia",
  alternates: { canonical: "/" },
};

export default function Page() {
  return <LandingClient />;
}
