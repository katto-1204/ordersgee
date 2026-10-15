import { useEffect, useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import DialogFrame from './DialogFrame'
import { answerConfirmation, subscribeToConfirmations, type ActiveConfirmation } from '../lib/confirm'

export default function ConfirmDialogHost() {
  const [request, setRequest] = useState<ActiveConfirmation | null>(null)
  useEffect(() => { const unsubscribe = subscribeToConfirmations(setRequest); return () => { unsubscribe() } }, [])
  const answer = (confirmed: boolean) => { if (request) answerConfirmation(request.id, confirmed) }
  const approval = request?.title.toLowerCase().includes('artwork') ?? false
  return <DialogFrame open={Boolean(request)} onOpenChange={open => { if (!open) answer(false) }} title={request?.title ?? 'Please confirm'} description={approval ? 'You choose what happens next. Nothing moves until you confirm.' : undefined}>
    {request && <div className="confirm-dialog-body">
      <span className={`confirm-dialog-icon ${approval ? 'confirm-icon-approval' : ''}`}>{approval ? <ShieldCheck size={19} /> : <AlertTriangle size={19} />}</span>
      <p>{request.description}</p>
      <div className="dialog-footer">
        <button type="button" className="button button-quiet" onClick={() => answer(false)}>{request.cancelLabel ?? 'Cancel'}</button>
        <button type="button" className={`button ${request.tone === 'danger' ? 'button-danger' : 'button-primary'}`} onClick={() => answer(true)}>{request.confirmLabel}</button>
      </div>
    </div>}
  </DialogFrame>
}
