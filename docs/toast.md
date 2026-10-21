# In-app toast messages

`ToastProvider` wraps the app's navigation. Call `useToast()` from a screen or component:

```tsx
import { useToast } from '@/hooks/useToast';

const { showToast, hideToast } = useToast();

showToast({ type: 'success', title: 'Saved', message: 'Your changes have been saved.' });
showToast({ type: 'error', message: 'Unable to save. Please try again.' });
showToast({ type: 'warning', message: 'Check the selected hours.' });
showToast('Your download has started.');

const id = showToast({ message: 'Processing your request…', duration: 0 });
if (id !== null) hideToast(id);
```

- Types: `success`, `error`, `warning`, `info` (default).
- Default timeout: 3.5 seconds, or 5 seconds for errors. Android accessibility settings can extend it. `duration: 0` keeps the toast until dismissed.
- A new message replaces the previous one. An older timer or dismiss callback cannot close the newer message.
- Messages appear at the top, respect safe areas and the offline banner, support light/dark mode, and include a dismiss button. Swipe left, right, or up to dismiss; a short or interrupted drag returns the toast to its original position.
- Use toasts for short feedback. Keep confirmation dialogs for decisions such as continuing despite a schedule warning. Native modals have their own presentation layer: close them first, or mount `<ToastViewport active={visible} />` inside the modal using the same `@/hooks/useToast` import. The latest active viewport displays the toast without duplicating it behind the modal. The weekly schedule editor already includes this viewport.

Used for saving and removing jobs on student Home (All jobs, Nearby, For you, and Saved) and Job details, and for success/error feedback after clearing a chat. Clearing a chat still requires confirmation. A successful clear returns to the user's Messages tab; a failed clear stays in the conversation. This uses existing React Native APIs and needs no new native dependency.

Student uploads also use toasts: School ID, COR/COE, resume, and profile picture from Profile, and documents from Verification status. Upload spinners and file checks remain in place. Cancelling a picker shows no toast; server cooldowns retain their retry guidance in a warning toast. Upload success does not imply account verification approval.

Student skills and availability saves use success/error toasts. Failed availability saves keep the editor and draft open; error feedback appears above the editor. Successful saves close it and show the toast on Profile.

Successful Edit profile saves return to the previous screen immediately and show a success toast for students, employers, and households. Validation and save-error dialogs remain on the form.
