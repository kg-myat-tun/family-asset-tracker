import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteAssetButton } from "@/components/assets/DeleteAssetButton";
import { VisibilityBadge } from "@/components/ui/VisibilityBadge";
import { getAsset } from "@/lib/assets.server";
import { requireUser } from "@/lib/auth.server";
import { convertAmount, formatCurrency, getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { canViewAsset } from "@/lib/visibility";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const asset = await getAsset(family.id, assetId);
  if (!asset || !canViewAsset(asset, user.uid)) notFound();

  const [rates, members, { dict }] = await Promise.all([
    getCachedRates(family.id),
    getFamilyMembers(family.id),
    getServerI18n(),
  ]);

  const owner = members.find((m) => m.uid === asset.ownerId);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = asset.ownerId === user.uid || self?.role === "admin";
  const converted = convertAmount(asset.amount, asset.currency, family.baseCurrency, rates);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{asset.name}</h1>
          <VisibilityBadge visibility={asset.visibility} />
        </div>
        {canMutate && (
          <div className="flex items-center gap-3">
            <Link href={`/assets/${asset.id}/edit`} className="text-sm text-accent hover:underline">
              {dict.assets.edit}
            </Link>
            <DeleteAssetButton assetId={asset.id} label={asset.name} />
          </div>
        )}
      </div>

      <dl className="bg-card rounded-xl border border-line divide-y divide-line">
        <Row label={dict.assets.category}>
          <span>{dict.assets.categories[asset.category]}</span>
        </Row>
        <Row label={dict.assets.amount}>
          <div>
            <p className="font-semibold">{formatCurrency(asset.amount, asset.currency)}</p>
            {asset.currency !== family.baseCurrency && (
              <p className="text-xs text-muted">
                ≈ {formatCurrency(converted, family.baseCurrency)}
              </p>
            )}
          </div>
        </Row>
        <Row label={dict.assets.owner}>{owner?.displayName ?? dict.assets.unknownOwner}</Row>
        {asset.description && <Row label={dict.assets.description}>{asset.description}</Row>}
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground text-right">{children}</dd>
    </div>
  );
}
