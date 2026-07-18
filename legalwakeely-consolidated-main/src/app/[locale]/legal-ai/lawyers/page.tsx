import { Link } from "@/i18n/navigation";
import { mockLawyers, specialtyLabels, cityLabels } from "@/lib/mock-data";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/star-rating";
import { CheckCircle2, Gavel, MapPin, Globe2, Sparkles, Search } from "lucide-react";

type SP = { [key: string]: string | string[] | undefined };

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function toggleParam(current: string[], value: string): string {
  const set = new Set(current);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set).join(",");
}

function buildHref(
  sp: SP,
  changes: Record<string, string | undefined>,
): string {
  const next = new URLSearchParams();
  const merged: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (changes[k] !== undefined) continue;
    const arr = asArray(v);
    if (arr.length) merged[k] = arr;
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) continue;
    if (v) merged[k] = [v];
  }
  for (const [k, arr] of Object.entries(merged)) {
    for (const item of arr) next.append(k, item);
  }
  const s = next.toString();
  return s ? `/lawyers?${s}` : "/lawyers";
}

function FilterPill({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={
        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors " +
        (active
          ? "border-brand-500 bg-brand-500 text-white shadow-sm"
          : "border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700")
      }
    >
      {label}
    </Link>
  );
}

export default function LawyersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  return <LawyersPageInner searchParams={searchParams} />;
}

async function LawyersPageInner({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const specFilter = asArray(sp.spec);
  const cityFilter = asArray(sp.city);
  const maxFeeStr = asArray(sp.fee)[0];
  const minRatingStr = asArray(sp.rating)[0];
  const q = (asArray(sp.q)[0] ?? "").toLowerCase().trim();

  const maxFee = maxFeeStr ? parseInt(maxFeeStr, 10) : null;
  const minRating = minRatingStr ? parseFloat(minRatingStr) : null;

  let filtered = mockLawyers;
  if (specFilter.length) {
    filtered = filtered.filter((l) => l.specialties.some((s) => specFilter.includes(s)));
  }
  if (cityFilter.length) {
    filtered = filtered.filter((l) => l.cities.some((c) => cityFilter.includes(c)));
  }
  if (maxFee != null && !Number.isNaN(maxFee)) {
    filtered = filtered.filter((l) => l.hourlyRate <= maxFee);
  }
  if (minRating != null && !Number.isNaN(minRating)) {
    filtered = filtered.filter((l) => l.rating >= minRating);
  }
  if (q) {
    filtered = filtered.filter((l) => {
      const blob = [
        l.name,
        l.bio.ar,
        l.bio.en,
        l.specialties.map((s) => specialtyLabels[s]?.ar ?? s).join(" "),
        l.specialties.map((s) => specialtyLabels[s]?.en ?? s).join(" "),
        l.cities.map((c) => cityLabels[c]?.ar ?? c).join(" "),
        l.cities.map((c) => cityLabels[c]?.en ?? c).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }

  const allSpecialties = Array.from(new Set(mockLawyers.flatMap((l) => l.specialties)));
  const allCities = Array.from(new Set(mockLawyers.flatMap((l) => l.cities)));
  const hasAnyFilter =
    specFilter.length > 0 || cityFilter.length > 0 || maxFee != null || minRating != null || q.length > 0;

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge tone="info" icon={<Sparkles className="h-3.5 w-3.5" />}>
            دليل محامين موثّق
          </Badge>
          <h1 className="mt-3 text-2xl font-extrabold text-ink-900 sm:text-3xl">
            محامون مرخّصون في الأردن
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            تصفّح دليل المحامين، صفِّ حسب التخصص والموقع والأتعاب. جميع المحامين تم
            التحقق من رقم نقابتهم.
          </p>
        </div>
        <div className="text-end">
          <div className="text-2xl font-extrabold text-brand-700">{filtered.length}</div>
          <div className="text-xs text-ink-500">
            {hasAnyFilter ? "نتيجة مطابقة" : "محامٍ متاح"}
          </div>
        </div>
      </div>

      <Card>
        <CardBody>
          <form action="/lawyers" method="get" className="mb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="ابحث بالاسم أو التخصص أو المدينة..."
                className="w-full rounded-xl border border-ink-200 bg-white px-4 py-2.5 pe-10 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              {/* preserve other filters when searching */}
              {specFilter.map((s) => (
                <input key={"spec-" + s} type="hidden" name="spec" value={s} />
              ))}
              {cityFilter.map((c) => (
                <input key={"city-" + c} type="hidden" name="city" value={c} />
              ))}
              {maxFee != null && <input type="hidden" name="fee" value={String(maxFee)} />}
              {minRating != null && <input type="hidden" name="rating" value={String(minRating)} />}
            </div>
          </form>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FilterGroup
              label="التخصص"
              options={allSpecialties.map((s) => ({
                v: s,
                l: specialtyLabels[s]?.ar ?? s,
              }))}
              activeValues={specFilter}
              buildHref={(v) =>
                buildHref(sp, { spec: toggleParam(specFilter, v) })
              }
            />
            <FilterGroup
              label="المدينة"
              options={allCities.map((c) => ({
                v: c,
                l: cityLabels[c]?.ar ?? c,
              }))}
              activeValues={cityFilter}
              buildHref={(v) =>
                buildHref(sp, { city: toggleParam(cityFilter, v) })
              }
            />
            <FilterGroup
              label="الحد الأقصى للأتعاب"
              options={[
                { v: "60", l: "≤ 60 د.أ" },
                { v: "100", l: "≤ 100 د.أ" },
                { v: "150", l: "≤ 150 د.أ" },
              ]}
              activeValues={maxFee != null ? [String(maxFee)] : []}
              buildHref={(v) => buildHref(sp, { fee: v })}
            />
            <FilterGroup
              label="التقييم"
              options={[
                { v: "4.5", l: "≥ 4.5 ⭐" },
                { v: "4.0", l: "≥ 4.0 ⭐" },
              ]}
              activeValues={minRating != null ? [String(minRating)] : []}
              buildHref={(v) => buildHref(sp, { rating: v })}
            />
          </div>

          {hasAnyFilter && (
            <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
              <p className="text-xs text-ink-500">
                {filtered.length} من {mockLawyers.length} محامٍ
              </p>
              <Link
                href="/legal-ai/lawyers"
                className="text-xs font-semibold text-brand-700 hover:text-brand-800"
              >
                مسح الفلاتر
              </Link>
            </div>
          )}
        </CardBody>
      </Card>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-300 bg-white py-16 text-center">
          <p className="text-base font-semibold text-ink-800">
            لا يوجد محامون يطابقون الفلاتر المحددة.
          </p>
          <p className="mt-1 text-sm text-ink-500">
            جرّب توسيع نطاق البحث أو إزالة بعض الفلاتر.
          </p>
          <Link
            href="/legal-ai/lawyers"
            className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            عرض جميع المحامين
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <Card key={l.id} className="group flex flex-col overflow-hidden">
              <div className="flex items-start gap-3 border-b border-ink-100 p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={l.avatar}
                  alt={l.name}
                  className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-sm"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-bold text-ink-900">{l.name}</h3>
                    {l.verified && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                    <StarRating value={l.rating} />
                    <span className="font-semibold text-ink-700">{l.rating}</span>
                    <span>({l.totalReviews} تقييم)</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-ink-500">
                    <Gavel className="h-3 w-3" />
                    نقابة: {l.barNumber}
                  </div>
                </div>
              </div>

              <CardBody className="flex-1 space-y-3">
                <p className="line-clamp-2 text-sm leading-7 text-ink-600">{l.bio.ar}</p>
                <div className="flex flex-wrap gap-1.5">
                  {l.specialties.map((s) => (
                    <Badge key={s} tone="info">
                      {specialtyLabels[s]?.ar ?? s}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {l.cities.map((c) => cityLabels[c]?.ar ?? c).join("، ")}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Globe2 className="h-3 w-3" />
                    {l.languages.includes("ar") ? "عربي" : ""}
                    {l.languages.includes("en") ? "، English" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-ink-100 pt-3 text-center">
                  <div>
                    <div className="text-sm font-bold text-ink-900">
                      {l.yearsExperience}
                    </div>
                    <div className="text-[10px] text-ink-500">سنة خبرة</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink-900">
                      {l.successStories}
                    </div>
                    <div className="text-[10px] text-ink-500">قضية ناجحة</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink-900">
                      {l.hourlyRate} د.أ
                    </div>
                    <div className="text-[10px] text-ink-500">للساعة</div>
                  </div>
                </div>
              </CardBody>

              <div className="flex gap-2 border-t border-ink-100 p-4">
                <Link href={`/lawyers/${l.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    عرض الملف
                  </Button>
                </Link>
                <Link href={`/lawyers/${l.id}#contact`} className="flex-1">
                  <Button size="sm" className="w-full" disabled={!l.isAvailable}>
                    {l.isAvailable ? "إرسال طلب" : "غير متاح"}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  options,
  activeValues,
  buildHref,
}: {
  label: string;
  options: { v: string; l: string }[];
  activeValues: string[];
  buildHref: (v: string) => string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-ink-700">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <FilterPill
            key={o.v}
            label={o.l}
            active={activeValues.includes(o.v)}
            href={buildHref(o.v)}
          />
        ))}
      </div>
    </div>
  );
}
