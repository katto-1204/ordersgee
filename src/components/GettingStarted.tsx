import { ArrowRight, CheckCircle2, ClipboardPaste, FileCheck2, HelpCircle, Layers3, ListTodo, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useShop } from '../stores/shop'
import DialogFrame from './DialogFrame'
import './getting-started.css'

export function DashboardGettingStarted() {
  const { settings, updateSettings } = useShop()
  if (settings?.guideDismissedAt) return null
  return <section className="getting-started-card" aria-labelledby="getting-started-title">
    <div className="getting-started-header"><div><span className="guide-kicker"><HelpCircle size={14} /> A QUICK START</span><h2 id="getting-started-title">Not sure where to begin?</h2><p>Follow these steps to move one team’s order from arrival to delivery.</p></div><button type="button" className="text-button guide-hide-button" onClick={() => void updateSettings({ guideDismissedAt: new Date().toISOString() })}>Hide this guide</button></div>
    <ol className="getting-started-steps">
      <li><span className="guide-step-number">1</span><div><strong>Bring in your work</strong><small>Paste your list with Quick Capture, or create one order.</small><div className="guide-step-actions"><Link to="/orders?capture=1"><ClipboardPaste size={13} /> Paste a list</Link><Link to="/orders"><span className="sr-only">Open </span>All orders <ArrowRight size={12} /></Link></div></div></li>
      <li><span className="guide-step-number">2</span><div><strong>Fill in what you know</strong><small>Add a due date, quantity, size breakdown and person responsible. Leave unknown details blank.</small></div></li>
      <li><span className="guide-step-number">3</span><div><strong>Check artwork approval</strong><small>Mark the artwork Approved before printing. If it is approved outside this app, you can continue with a clearly logged override.</small></div></li>
      <li><span className="guide-step-number">4</span><div><strong>Move it to the next step</strong><small>Use the order’s stage menu or the Production Board. Changes save on this device.</small><div className="guide-step-actions"><Link to="/production"><Layers3 size={13} /> Open the board</Link><Link to="/tasks"><ListTodo size={13} /> Check tasks</Link></div></div></li>
    </ol>
    <div className="getting-started-footer"><span><CheckCircle2 size={15} /> Sample orders are ready to edit. Export a JSON backup in Settings to keep a copy of your work.</span><Link to="/settings#data">Backup settings <ArrowRight size={13} /></Link></div>
  </section>
}

export function GettingStartedDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <DialogFrame open={open} onOpenChange={onOpenChange} title="How to use GEE TASKS" description="A simple path from a new customer request to a finished order." wide>
    <div className="guide-dialog-content">
      <ol className="full-guide-steps">
        <li><span>1</span><div><strong>Add or paste an order</strong><p>Use <b>Quick Capture</b> to paste your existing list or import a .txt file. Review each line before saving. Use <b>New order</b> when you want to enter one job by hand.</p></div></li>
        <li><span>2</span><div><strong>Fill only the details you know</strong><p>Open a team’s order to add the deadline, size quantities, quantity, contact/reference, staff member, notes and checklist. You can leave missing information blank and add it later.</p></div></li>
        <li><span>3</span><div><strong>Get the artwork approved</strong><p>Set Artwork approval to <b>For Client Approval</b>, then set it to <b>Approved</b> when the customer agrees. Starting production on unapproved art pauses for an explanation; only continue if the customer has already approved it.</p></div></li>
        <li><span>4</span><div><strong>Keep the next step current</strong><p>Use <b>Production Board</b> to see each stage, or open an order and choose its stage. The usual route is Sizing → Printing → Done Print → To Sew → To Deliver → Finished. Layout, Press, Revision, Resize and On Hold can be used when a job needs a different route.</p></div></li>
        <li><span>5</span><div><strong>Check today’s work</strong><p>The Dashboard brings together due work, overdue orders, urgent tasks and items waiting for approval or missing details. Use <b>My Tasks</b> for stand-alone shop reminders and attach a task to an order when it belongs to a specific job.</p></div></li>
      </ol>
      <div className="guide-approval-note"><ShieldCheck size={17} /><div><strong>Before you move to printing</strong><p>If the artwork is not marked approved, choose <b>Keep order here</b> and update the approval field—or continue only when you already have the customer’s approval. Continuing logs the decision in the order’s Activity.</p></div></div>
      <div className="guide-local-note"><FileCheck2 size={16} /><p><b>Your saved workspace:</b> your changes are saved in this browser on this device. Connect Google Sheets in Settings to save and load shared records. Use Settings → Data &amp; backup → Export full JSON to keep a copy. Photos and mockups stay with their team/order; use All Teams & Photos to collect pictures after production.</p></div>
      <div className="dialog-footer guide-dialog-actions"><Link className="button button-primary" to="/orders?capture=1" onClick={() => onOpenChange(false)}><ClipboardPaste size={14} /> Paste or import a list</Link><Link className="button button-quiet" to="/production" onClick={() => onOpenChange(false)}><Layers3 size={14} /> Open production board</Link></div>
    </div>
  </DialogFrame>
}
