import { useDarkMode } from '@/hooks/useDarkMode';
import { addScheduleSlot, currentScheduleDay, formatTime, ScheduleDraft, scheduleError, ScheduleSlot, SCHEDULE_PRESETS, slotLabel, WeekDay, WEEK_DAYS, weeklyHours } from '@/utils/weeklySchedule';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useEffect, useRef, useState } from 'react';
import { ToastViewport } from '@/hooks/useToast';
import { ActivityIndicator, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  value: ScheduleDraft;
  mode: 'student' | 'job';
  defaultToToday?: boolean;
  onClose: () => void;
  onSave: (value: ScheduleDraft) => Promise<boolean> | boolean;
}

const DAY_NAMES: Record<WeekDay, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};
const sameSlot = (a: ScheduleSlot, b: ScheduleSlot) => a.day_of_week === b.day_of_week
  && a.start_time === b.start_time && a.end_time === b.end_time && a.ends_next_day === b.ends_next_day;

export default function WeeklyScheduleModal({ visible, value, mode, defaultToToday = false, onClose, onSave }: Props) {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ScheduleDraft>({ days: [], slots: [] });
  const [activeDay, setActiveDay] = useState<WeekDay | null>(null);
  const [addingHours, setAddingHours] = useState(false);
  const [custom, setCustom] = useState(false);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('15:00');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copy, setCopy] = useState(false);
  const [copyDays, setCopyDays] = useState<WeekDay[]>([]);
  const [iosField, setIosField] = useState<'start' | 'end' | null>(null);
  const [notice, setNotice] = useState('');
  const [errorArea, setErrorArea] = useState<'page' | 'hours' | 'copy'>('page');
  const opened = useRef(false);
  const busy = useRef(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && !opened.current) {
      const today = defaultToToday && mode === 'job' && !value.days.length && !value.slots.length ? currentScheduleDay() : null;
      setDraft({ days: today ? [today] : [...value.days], slots: value.slots.map(slot => ({ ...slot })) });
      setActiveDay(today);
      setAddingHours(Boolean(today));
      setCustom(false);
      setCopy(false);
      setCopyDays([]);
      setIosField(null);
      setStart('09:00');
      setEnd('15:00');
      setError('');
      setNotice('');
    }
    opened.current = visible;
  }, [visible, value, mode, defaultToToday]);

  const accent = colors.primary;
  const tint = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const field = isDark ? colors.background : '#F8FAFC';
  const muted = isDark ? '#263449' : '#F1F5F9';
  const student = mode === 'student';
  const nextDay = activeDay ? WEEK_DAYS[(WEEK_DAYS.indexOf(activeDay) + 1) % 7] : 'Tue';
  const overnight = end < start;
  const completeDays = draft.days.filter(day => draft.slots.some(slot => slot.day_of_week === day)).length;
  const hours = weeklyHours(draft.slots).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const saveLabel = student ? 'Save availability' : 'Use this schedule';
  const pendingInput = custom || (copy && copyDays.length > 0);
  const saveDisabled = saving || !draft.days.length || pendingInput;
  const close = () => { if (!busy.current) onClose(); };

  const clearExtras = () => {
    setError(''); setNotice(''); setCustom(false); setCopy(false); setCopyDays([]); setIosField(null);
  };
  const openDay = (day: WeekDay) => {
    if (busy.current) return;
    clearExtras();
    if (activeDay === day) { setActiveDay(null); return; }
    if (!draft.days.includes(day)) {
      setDraft({ ...draft, days: WEEK_DAYS.filter(value => value === day || draft.days.includes(value)) });
    }
    setActiveDay(day);
    setAddingHours(!draft.slots.some(slot => slot.day_of_week === day));
  };
  const toggleDay = (day: WeekDay) => {
    if (busy.current) return;
    clearExtras();
    if (draft.days.includes(day)) {
      setDraft({ days: draft.days.filter(value => value !== day), slots: draft.slots.filter(slot => slot.day_of_week !== day) });
      if (activeDay === day) setActiveDay(null);
    } else {
      setDraft({ ...draft, days: WEEK_DAYS.filter(value => value === day || draft.days.includes(value)) });
      setActiveDay(day); setAddingHours(true);
    }
  };
  const validateHours = (slots: ScheduleSlot[]) => scheduleError({
    days: WEEK_DAYS.filter(day => slots.some(slot => slot.day_of_week === day)), slots,
  });
  const add = (slot: ScheduleSlot) => {
    if (busy.current) return;
    const slots = addScheduleSlot(draft.slots, slot);
    const problem = validateHours(slots);
    if (problem) { setErrorArea('hours'); setError(problem); return; }
    setDraft({ ...draft, slots });
    setError(''); setNotice(''); setCustom(false); setAddingHours(false); setIosField(null);
  };
  const remove = (slot: ScheduleSlot) => {
    if (busy.current) return;
    const slots = draft.slots.filter(value => !sameSlot(value, slot));
    setDraft({ ...draft, slots });
    setAddingHours(!slots.some(value => value.day_of_week === slot.day_of_week));
    setError(''); setNotice(''); setCopy(false);
  };
  const addCustom = () => {
    if (!activeDay || busy.current) return;
    if (start === end) { setErrorArea('hours'); setError('Choose different start and end times. For 24 hours, choose Whole day.'); return; }
    const slot = { day_of_week: activeDay, start_time: start, end_time: end, ends_next_day: overnight };
    const problem = scheduleError({ days: [activeDay], slots: [slot] });
    if (problem) { setErrorArea('hours'); setError(problem); return; }
    add(slot);
  };
  const pick = (which: 'start' | 'end') => {
    if (busy.current) return;
    if (Platform.OS === 'ios') { setIosField(which); return; }
    if (Platform.OS !== 'android') return;
    const [hour, minute] = (which === 'start' ? start : end).split(':').map(Number);
    const date = new Date(); date.setHours(hour || 0, minute || 0, 0, 0);
    DateTimePickerAndroid.open({
      value: date, mode: 'time', is24Hour: false,
      onChange: (event, selected) => {
        if (event.type !== 'set' || !selected || busy.current) return;
        const text = `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`;
        (which === 'start' ? setStart : setEnd)(text); setError('');
      },
    });
  };
  const applyCopy = () => {
    if (!activeDay || !copyDays.length || busy.current) return;
    const slots = [
      ...draft.slots.filter(slot => !copyDays.includes(slot.day_of_week)),
      ...copyDays.flatMap(day => draft.slots.filter(slot => slot.day_of_week === activeDay).map(slot => ({ ...slot, day_of_week: day }))),
    ];
    const problem = validateHours(slots);
    if (problem) { setErrorArea('copy'); setError(problem); return; }
    setDraft({ days: WEEK_DAYS.filter(day => draft.days.includes(day) || copyDays.includes(day)), slots });
    setNotice(`Hours copied to ${copyDays.map(day => DAY_NAMES[day]).join(', ')}.`);
    setCopy(false); setCopyDays([]); setError('');
  };
  const save = async () => {
    if (busy.current || pendingInput) return;
    const problem = scheduleError(draft);
    setErrorArea('page');
    if (problem) {
      setError(problem);
      const missing = draft.days.find(day => !draft.slots.some(slot => slot.day_of_week === day));
      if (missing) { setActiveDay(missing); setAddingHours(true); setCustom(false); setCopy(false); }
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    busy.current = true; setSaving(true); setError(''); setNotice('');
    try {
      if (await onSave(draft)) onClose();
      else { setError('Your hours were not saved. Please try again.'); scroll.current?.scrollTo({ y: 0, animated: true }); }
    } catch {
      setError('Unable to save. Please try again.'); scroll.current?.scrollTo({ y: 0, animated: true });
    } finally { busy.current = false; setSaving(false); }
  };

  const textAction = (label: string, action: () => void, icon: keyof typeof MaterialIcons.glyphMap) => (
    <TouchableOpacity onPress={action} disabled={saving} accessibilityRole="button" accessibilityState={{ disabled: saving }}
      style={{ minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: saving ? 0.5 : 1 }}>
      <MaterialIcons name={icon} size={18} color={accent} />
      <Text style={{ color: accent, fontSize: 12, fontWeight: '600', flexShrink: 1 }}>{label}</Text>
    </TouchableOpacity>
  );

  const errorMessage = () => <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, padding: 13, backgroundColor: tint, borderRadius: 12 }}>
    <MaterialIcons name="info-outline" size={18} color={accent} />
    <Text style={{ color: colors.text, flex: 1, fontSize: 12, lineHeight: 20 }}>{error}</Text>
  </View>;

  const renderHours = (day: WeekDay, slots: ScheduleSlot[]) => (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
      <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 2 }} />
      {slots.length > 0 && <View style={{ gap: 8 }}>
        {slots.map(slot => <View key={`${slot.start_time}-${slot.end_time}`} style={{ paddingLeft: 12, paddingVertical: 3, borderRadius: 12, backgroundColor: field, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MaterialIcons name="schedule" size={17} color={accent} />
          <Text style={{ flex: 1, color: colors.text, fontSize: 12, fontWeight: '500', lineHeight: 20 }}>{slotLabel(slot)}</Text>
          <TouchableOpacity onPress={() => remove(slot)} disabled={saving} accessibilityRole="button" accessibilityLabel={`Remove ${slotLabel(slot)} on ${DAY_NAMES[day]}`} style={{ padding: 12 }}>
            <MaterialIcons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>)}
      </View>}
      {addingHours && <>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 2 }}>QUICK CHOICES</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SCHEDULE_PRESETS.map(preset => {
            const slot = { day_of_week: day, start_time: preset.start, end_time: preset.end, ends_next_day: preset.next };
            const checked = slots.some(value => sameSlot(value, slot));
            return <TouchableOpacity key={preset.label} onPress={() => checked ? remove(slot) : add(slot)} disabled={saving}
              accessibilityRole="checkbox" accessibilityLabel={`${preset.label}, ${slotLabel(slot)}, ${DAY_NAMES[day]}`} accessibilityState={{ checked, disabled: saving }}
              style={{ flexBasis: '47%', flexGrow: 1, minHeight: 72, padding: 12, borderRadius: 12, backgroundColor: checked ? tint : field, borderWidth: 1, borderColor: checked ? accent : colors.border, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <MaterialIcons name={checked ? 'check-circle' : preset.icon} size={16} color={accent} />
                <Text style={{ flex: 1, color: checked ? accent : colors.text, fontWeight: '600', fontSize: 12 }}>{preset.label}</Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 10, lineHeight: 16 }}>{preset.label === 'Whole day' ? 'Full day · 24 hours' : `${formatTime(preset.start)} – ${formatTime(preset.end)}${preset.next ? '\nEnds next day' : ''}`}</Text>
            </TouchableOpacity>;
          })}
        </View>
        {textAction(custom ? 'Hide exact hours' : 'Choose exact hours', () => { setCustom(!custom); setError(''); setCopy(false); setIosField(null); }, 'tune')}
      </>}
      {custom && <View style={{ padding: 14, borderRadius: 14, backgroundColor: field, gap: 14 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Exact hours for {DAY_NAMES[day]}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          {(['start', 'end'] as const).map(which => <View key={which} style={{ flex: 1, gap: 7 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{which === 'start' ? 'From' : 'To'}</Text>
            {Platform.OS === 'web' ? <TextInput accessibilityLabel={`${which} time, HH:MM`} value={which === 'start' ? start : end}
              onChangeText={text => { (which === 'start' ? setStart : setEnd)(text); setError(''); }} editable={!saving} placeholder="HH:MM" maxLength={5}
              style={{ color: colors.text, fontSize: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: 48 }} />
              : <TouchableOpacity onPress={() => pick(which)} disabled={saving} accessibilityRole="button" accessibilityLabel={`Choose ${which} time, ${formatTime(which === 'start' ? start : end)}`}
                style={{ minHeight: 48, padding: 12, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{formatTime(which === 'start' ? start : end)}</Text>
                <MaterialIcons name="expand-more" size={18} color={colors.textSecondary} />
              </TouchableOpacity>}
          </View>)}
        </View>
        {iosField && <View>
          <DateTimePicker mode="time" display="spinner" themeVariant={isDark ? 'dark' : 'light'} value={(() => {
            const date = new Date(); const [hour, minute] = (iosField === 'start' ? start : end).split(':').map(Number); date.setHours(hour, minute, 0, 0); return date;
          })()} onChange={(_, date) => {
            if (date && !busy.current) (iosField === 'start' ? setStart : setEnd)(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
          }} />
          {textAction('Done choosing time', () => setIosField(null), 'check')}
        </View>}
        {overnight && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="nights-stay" size={16} color={accent} />
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 20, flex: 1 }}>Ends on {DAY_NAMES[nextDay]} at {formatTime(end)}.</Text>
        </View>}
        {!!error && errorArea === 'hours' && errorMessage()}
        <TouchableOpacity onPress={addCustom} disabled={saving} accessibilityRole="button" style={{ minHeight: 46, backgroundColor: accent, borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Add hours</Text>
        </TouchableOpacity>
      </View>}
      {!!error && errorArea === 'hours' && !custom && errorMessage()}
      {slots.length > 0 && !addingHours && slots.length < 3 && textAction('Add more hours', () => { setAddingHours(true); setCopy(false); setError(''); }, 'add')}
      {slots.length > 0 && textAction(copy ? 'Cancel copying' : 'Same hours on other days', () => { setCopy(!copy); setCopyDays([]); setError(''); setCustom(false); setAddingHours(false); setIosField(null); }, 'content-copy')}
      {copy && <View style={{ padding: 14, backgroundColor: field, borderRadius: 14, gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{`Use ${DAY_NAMES[day]}'s hours on:`}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WEEK_DAYS.filter(value => value !== day).map(value => {
            const checked = copyDays.includes(value);
            return <TouchableOpacity key={value} disabled={saving} onPress={() => setCopyDays(checked ? copyDays.filter(d => d !== value) : [...copyDays, value])}
              accessibilityRole="checkbox" accessibilityLabel={`Copy to ${DAY_NAMES[value]}`} accessibilityState={{ checked, disabled: saving }}
              style={{ minHeight: 44, minWidth: 60, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: checked ? accent : colors.border, backgroundColor: checked ? tint : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: checked ? accent : colors.text, fontSize: 12, fontWeight: '600' }}>{value}</Text>
            </TouchableOpacity>;
          })}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 18 }}>This replaces any hours already set for those days.</Text>
        {!!error && errorArea === 'copy' && errorMessage()}
        <TouchableOpacity onPress={applyCopy} disabled={saving || !copyDays.length} accessibilityRole="button" accessibilityState={{ disabled: saving || !copyDays.length }}
          style={{ minHeight: 46, padding: 12, borderRadius: 10, backgroundColor: accent, opacity: copyDays.length ? 1 : 0.4, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Apply hours</Text>
        </TouchableOpacity>
      </View>}
    </View>
  );

  return <Modal visible={visible} animationType="slide" onRequestClose={close}>
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }} accessibilityViewIsModal>
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border }}>
        <View style={{ width: '100%', maxWidth: 672, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, backgroundColor: tint, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}><MaterialIcons name="calendar-today" size={20} color={accent} /></View>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{student ? 'Your availability' : 'Work schedule'}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 3 }}>Weekly · Philippine time</Text>
          </View>
          <TouchableOpacity onPress={close} disabled={saving} accessibilityRole="button" accessibilityLabel="Close schedule editor" style={{ padding: 12, marginRight: -10 }}><MaterialIcons name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
        </View>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', gap: 18 }}>
          <View style={{ paddingHorizontal: 4, gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', lineHeight: 32 }}>{student ? 'When can you work?' : 'When do you need help?'}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 22 }}>{student ? 'Turn on a day, then choose the hours you are free.' : 'Turn on a work day, then choose the hours needed.'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 4 }}>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>Your week</Text>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: muted }}>
              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '500' }}>{draft.days.length ? `${draft.days.length} ${draft.days.length === 1 ? 'day' : 'days'} selected` : 'Choose a day to start'}</Text>
            </View>
          </View>
          {!!error && errorArea === 'page' && errorMessage()}
          {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 20, paddingHorizontal: 4 }}>{notice}</Text>}
          <View style={{ gap: 10 }}>
            {WEEK_DAYS.map(day => {
              const selected = draft.days.includes(day);
              const expanded = selected && activeDay === day;
              const slots = draft.slots.filter(slot => slot.day_of_week === day);
              const summary = slots.length ? slots.map(slotLabel).join('\n') : selected ? 'Choose hours' : student ? 'Not available' : 'No work scheduled';
              return <View key={day} style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: expanded ? accent : colors.border, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 8 }}>
                  <TouchableOpacity onPress={() => openDay(day)} disabled={saving} accessibilityRole="button" accessibilityLabel={`Edit ${DAY_NAMES[day]} hours`} accessibilityState={{ expanded, disabled: saving }}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingRight: 4, minHeight: 78 }}>
                    <View style={{ width: 38, height: 42, borderRadius: 11, backgroundColor: selected ? tint : muted, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: selected ? accent : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>{day}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{DAY_NAMES[day]}</Text>
                      <Text style={{ color: selected && !slots.length ? accent : colors.textSecondary, fontSize: 11, lineHeight: 18 }}>{expanded && slots.length ? `${slots.length} ${slots.length === 1 ? 'time range' : 'time ranges'}` : summary}</Text>
                    </View>
                    {selected && <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={18} color={colors.textSecondary} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleDay(day)} disabled={saving} accessibilityRole="switch" accessibilityLabel={`${DAY_NAMES[day]} ${student ? 'availability' : 'work day'}`} accessibilityState={{ checked: selected, disabled: saving }}
                    style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 38, height: 24, borderRadius: 12, backgroundColor: selected ? accent : (isDark ? '#475569' : '#CBD5E1'), justifyContent: 'center', paddingHorizontal: 3, alignItems: selected ? 'flex-end' : 'flex-start' }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>{selected && <MaterialIcons name="check" size={12} color={accent} />}</View>
                    </View>
                  </TouchableOpacity>
                </View>
                {expanded && renderHours(day, slots)}
              </View>;
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4, alignItems: 'flex-start' }}>
            <MaterialIcons name="info-outline" size={15} color={colors.textSecondary} style={{ marginTop: 2 }} />
            <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 19, flex: 1 }}>{student ? 'Leave class hours out. You can add a separate time range before or after class.' : 'Each day can have different hours. Add a separate range if there is a break.'}</Text>
          </View>
        </View>
      </ScrollView>
      <View style={{ borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View style={{ width: '100%', maxWidth: 672, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, gap: 10 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'center' }}>{custom ? 'Tap Add hours to keep this time range' : copy && copyDays.length ? 'Tap Apply hours to confirm those days' : draft.days.length ? completeDays === draft.days.length ? `${draft.days.length} ${draft.days.length === 1 ? 'day' : 'days'} · ${hours} ${Number(weeklyHours(draft.slots)) === 1 ? 'hour' : 'hours'} per week` : `Add hours for ${draft.days.length - completeDays} more ${draft.days.length - completeDays === 1 ? 'day' : 'days'}` : 'Select at least one day'}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={close} disabled={saving} accessibilityRole="button" style={{ minWidth: 76, minHeight: 52, padding: 12, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => void save()} disabled={saveDisabled} accessibilityRole="button" accessibilityState={{ disabled: saveDisabled, busy: saving }}
              style={{ flex: 1, minHeight: 52, padding: 14, borderRadius: 12, backgroundColor: accent, opacity: !draft.days.length || pendingInput ? 0.45 : 1, alignItems: 'center', justifyContent: 'center' }}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{saveLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <ToastViewport active={visible} />
    </View>
  </Modal>;
}
