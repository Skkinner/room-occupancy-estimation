import { ClipboardPen, ShieldQuestion } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select, Textarea } from '@/components/ui/form'
import { useI18n } from '@/i18n'
import { INSPECTION_STATUSES } from '@/lib/safety'
import type { InspectionStatus } from '@/lib/types'
import { validateAlias } from '@/lib/validation'
import { useDemo } from '@/state/DemoStore'

/** Simulated manual check. Never triggered by the model; requires explicit confirmation. */
export function ManualCheckForm({ roomId, roomLabel }: { roomId: string; roomLabel: string }) {
  const { t } = useI18n()
  const { state, recordInspection } = useDemo()
  const ids = { alias: useId(), status: useId(), comment: useId(), aliasErr: useId(), statusErr: useId(), note: useId() }
  const [alias, setAlias] = useState('')
  const [status, setStatus] = useState<InspectionStatus | ''>('')
  const [comment, setComment] = useState('')
  const [touched, setTouched] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const aliasOk = validateAlias(alias)
  const statusOk = status !== ''

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (aliasOk && statusOk) setConfirmOpen(true)
  }

  const onConfirm = () => {
    if (!statusOk) return
    recordInspection({ roomId, actor: alias, status, comment })
    toast(t('room.toastTitle'), { description: t('room.toastBody', { room: roomLabel, status: t(`inspectionShort.${status}`) }) })
    setStatus('')
    setComment('')
    setTouched(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardPen className="size-4 text-teal-300" aria-hidden />
          {t('room.checkTitle')}
        </CardTitle>
        <CardDescription id={ids.note} className="flex gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-amber-100/90">
          <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          {t('room.checkNote')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate aria-describedby={ids.note} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={ids.alias}>{t('room.alias')}</Label>
            <Input
              id={ids.alias}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              autoComplete="off"
              maxLength={40}
              aria-invalid={touched && !aliasOk}
              aria-describedby={touched && !aliasOk ? ids.aliasErr : undefined}
              required
            />
            {touched && !aliasOk ? (
              <p id={ids.aliasErr} className="text-xs text-amber-300">{t('room.aliasError')}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t('room.aliasHint')}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.status}>{t('room.status')}</Label>
            <Select
              id={ids.status}
              value={status}
              onChange={(e) => setStatus(e.target.value as InspectionStatus | '')}
              aria-invalid={touched && !statusOk}
              aria-describedby={touched && !statusOk ? ids.statusErr : undefined}
              required
            >
              <option value="" disabled>
                —
              </option>
              {INSPECTION_STATUSES.filter((s) => s !== 'unknown').map((s) => (
                <option key={s} value={s}>
                  {t(`inspection.${s}`)}
                </option>
              ))}
            </Select>
            {touched && !statusOk && <p id={ids.statusErr} className="text-xs text-amber-300">{t('room.statusError')}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.comment}>{t('room.comment')}</Label>
            <Textarea
              id={ids.comment}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={280}
              placeholder={t('room.commentPlaceholder')}
            />
          </div>
          <div className="rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{t('room.timestamp')}: </span>
            {t('room.timestampValue', { step: state.replay.step + 1 })}
          </div>
          <Button type="submit" className="w-full sm:w-auto">
            {t('room.submit')}
          </Button>
        </form>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('room.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusOk && t('room.confirmBody', { room: roomLabel, status: t(`inspection.${status}`) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>{t('room.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
