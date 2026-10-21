import WeeklyScheduleModal from '@/components/schedule/WeeklyScheduleModal';
import { scheduleDraft, ScheduleSlot, weeklySummary } from '@/utils/weeklySchedule';
import React from 'react';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentDays: string[];
  currentTimeSlot: string;
  currentSlots?: ScheduleSlot[];
  onSave: (days: string[], timeSlot: string, slots: ScheduleSlot[]) => Promise<boolean>;
}

export default function EditAvailabilityModal({ visible, onClose, currentDays, currentTimeSlot, currentSlots, onSave }: Props) {
  return <WeeklyScheduleModal visible={visible} mode="student" value={scheduleDraft(currentSlots, currentDays, currentTimeSlot)} onClose={onClose}
    onSave={draft => onSave(draft.days, weeklySummary(draft.slots), draft.slots)} />;
}
