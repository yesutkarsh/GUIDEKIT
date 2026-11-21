import Image from 'next/image'
import styles from './MetricGradient.module.css'

export type MetricGradientVariant = 'projects' | 'deployments' | 'localization'

const sources: Record<MetricGradientVariant, string> = {
  projects: '/images/dashboard/metrics/projects.svg',
  deployments: '/images/dashboard/metrics/deployments.svg',
  localization: '/images/dashboard/metrics/localization.svg',
}

export function MetricGradient({ variant }: { variant: MetricGradientVariant }) {
  return (
    <div className={styles.frame} aria-hidden="true">
      <Image
        className={styles.image}
        src={sources[variant]}
        alt=""
        fill
        sizes="(max-width: 639px) 33vw, (max-width: 1023px) 30vw, 360px"
        unoptimized
      />
    </div>
  )
}
