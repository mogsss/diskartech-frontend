# Online interview call

The manual video-call demo is now the actual `/online-interview-call` screen, opened from an application's **Join video call** button. It receives an application ID and obtains the participant token automatically from the authenticated backend. The old demo form and Settings development shortcut have been removed.

- Join stays disabled before the scheduled date/time (Philippine time), then enables automatically for the assigned student and employer/household.
- The other participant has the large video; your mirrored camera appears in a small preview at the upper right. Waiting/camera-off placeholders keep the same layout.
- **Leave** exits only your call and permits rejoining an active interview.
- Only the employer/household has **End Interview**, with confirmation through NotificationModal. This closes the interview for both participants and disables future joins. It does not change the application to hired/completed.
- A changed schedule reopens interview availability at the new scheduled start. Saving an unchanged schedule does not reopen an ended interview.

Deploy the backend changes and the new `interview_ended_at` migration before using the updated screen. See [backend setup and two-device checks](../../diskartech-backend/docs/livekit-interviews.md).

The installed app already includes LiveKit/WebRTC native modules. These screen/layout changes use Metro reload and do not require another APK. Expo Go still cannot join video calls.
