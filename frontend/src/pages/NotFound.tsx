import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

export default function NotFound() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-mono text-5xl font-bold text-muted-foreground">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t('notFound.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('notFound.body')}</p>
      <Button asChild className="mt-6">
        <Link to="/">{t('notFound.home')}</Link>
      </Button>
    </div>
  )
}
