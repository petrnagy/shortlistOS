import { t } from "@lingui/core/macro";
import { HiCheck } from "react-icons/hi2";

interface FeatureRow {
  label: string;
  inFree: boolean;
  inPowerpack: boolean;
}

const featureGroups: { title: string; items: FeatureRow[] }[] = [
  {
    title: t`Your job search at a glance`,
    items: [
      {
        label: t`Job hunting workspace with drag-and-drop pipeline`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Unlimited shortlists`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Unlimited opportunities per shortlist`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Activity timeline per opportunity`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Notes and file attachments`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Card fields: company, role, interview date, contacts`,
        inFree: true,
        inPowerpack: true,
      },
    ],
  },
  {
    title: t`Capturing opportunities`,
    items: [
      {
        label: t`Save jobs in one click with the browser web clipper`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Magic Inbox: forward any job email and auto-create or update cards`,
        inFree: false,
        inPowerpack: true,
      },
    ],
  },
  {
    title: t`Salary and company intelligence`,
    items: [
      {
        label: t`Automatic salary range for your target role`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Location-aware salary data: your country, EU, and US`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Salary percentile benchmarks: EU, US, and global`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Third-party employer ratings and review summary`,
        inFree: false,
        inPowerpack: true,
      },
    ],
  },
  {
    title: t`Automations and nudges`,
    items: [
      {
        label: t`Card aging: visual staleness on inactive opportunities`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Calendar feed for scheduled interviews`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Email reminders for upcoming interviews and next actions`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Auto-move to ghosted after silence in Applied`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Follow-up reminder for inactive applications`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Reminder when a saved opportunity sits untouched too long`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Auto-archive stale saved opportunities`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Nudges when interviews or negotiations lose momentum`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Weekly digest: what needs your attention right now`,
        inFree: false,
        inPowerpack: true,
      },
    ],
  },
  {
    title: t`Privacy and data`,
    items: [
      {
        label: t`No tracking, no ads, GDPR aligned`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Full data download anytime`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Made and hosted in the EU`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`CSV export`,
        inFree: true,
        inPowerpack: true,
      },
    ],
  },
];

export function FeatureComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-md border border-light-300 bg-light-50 dark:border-dark-300 dark:bg-dark-100">
      <table className="min-w-full table-fixed divide-y divide-light-600 text-left text-sm dark:divide-dark-600">
        <thead className="bg-light-300 dark:bg-dark-300">
          <tr>
            <th className="w-1/2 rounded-tl-lg px-4 py-3 text-left text-xs font-semibold tracking-wide text-light-900 dark:text-dark-900">
              {t`Feature`}
            </th>
            <th className="w-1/4 px-4 py-3 text-center text-xs font-semibold tracking-wide text-light-900 dark:text-dark-900">
              {t`shortlistOS`}
            </th>
            <th className="w-1/4 rounded-tr-lg px-4 py-3 text-center text-xs font-semibold tracking-wide text-light-900 dark:text-dark-900">
              {t`shortlistOS + Powerpack ⚡`}
            </th>
          </tr>
        </thead>

        {featureGroups.map((group) => (
          <tbody
            key={group.title}
            className="divide-y divide-light-600 bg-light-50 dark:divide-dark-600 dark:bg-dark-100"
          >
            <tr className="bg-light-100 dark:bg-dark-200">
              <td
                colSpan={3}
                className="px-4 py-2 text-xs font-semibold tracking-wide text-light-900 dark:text-dark-900"
              >
                {group.title}
              </td>
            </tr>
            {group.items.map((feature) => (
              <tr key={feature.label}>
                <td className="px-4 py-2 text-sm text-light-900 dark:text-dark-900">
                  {feature.label}
                </td>
                <td className="px-4 py-2 text-center align-middle">
                  {feature.inFree ? (
                    <HiCheck
                      className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="text-light-700 dark:text-dark-800">-</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center align-middle">
                  {feature.inPowerpack ? (
                    <HiCheck
                      className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="text-light-700 dark:text-dark-800">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
