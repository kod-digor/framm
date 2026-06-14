import { MarketingShell } from "@/components/marketing/marketing-shell";
import { AssociationHero } from "@/components/marketing/association-hero";
import { ValuesGrid } from "@/components/marketing/values-grid";
import { EcosystemComparison } from "@/components/marketing/ecosystem-comparison";
import { SchematicSection } from "@/components/marketing/schematic-section";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { AudienceStrip } from "@/components/marketing/audience-strip";
import { SignupCta } from "@/components/marketing/signup-cta";

export default function LandingPage() {
  return (
    <MarketingShell activeNav="home">
      <AssociationHero />
      <ValuesGrid />
      <EcosystemComparison />
      <SchematicSection />
      <ProductShowcase />
      <AudienceStrip />
      <SignupCta />
    </MarketingShell>
  );
}
