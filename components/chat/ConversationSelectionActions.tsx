import NotificationModal from '@/components/ui/modals/NotificationModal';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { useConversationSelection } from '@/hooks/useConversationSelection';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

export default function ConversationSelectionActions({ selection, disabled = false }: {
  selection: Pick<ReturnType<typeof useConversationSelection>,
    'mode' | 'busy' | 'selectedCount' | 'allVisibleSelected' | 'toggleAll' | 'requestDelete'
    | 'confirmationVisible' | 'confirmationCount' | 'confirmDelete' | 'cancelDelete'> & { enter: () => void };
  disabled?: boolean;
}) {
  const { colors } = useDarkMode();
  const blocked = disabled || selection.busy;
  return <>
    <View className="flex-row items-center gap-2">
      <TouchableOpacity
        onPress={() => selection.mode ? selection.toggleAll() : selection.enter()}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel={selection.mode ? selection.allVisibleSelected ? 'Deselect all visible conversations' : 'Select all visible conversations' : 'Select conversations'}
        className="min-h-11 items-center justify-center px-2"
      >
        <Text className="text-xs font-semibold" style={{ color: blocked ? colors.textSecondary : colors.accent }}>{selection.mode ? selection.allVisibleSelected ? 'Deselect all' : 'Select all' : 'Select'}</Text>
      </TouchableOpacity>
      {selection.mode && <TouchableOpacity
        onPress={selection.requestDelete}
        disabled={blocked || selection.selectedCount === 0}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${selection.selectedCount} selected conversations`}
        accessibilityState={{ disabled: blocked || selection.selectedCount === 0, busy: selection.busy }}
        className="min-h-11 items-center justify-center px-2"
      >
        {selection.busy ? <ActivityIndicator size="small" color={colors.accent} /> : <MaterialIcons name="delete-outline" size={23} color={blocked || selection.selectedCount === 0 ? colors.textSecondary : colors.accent} />}
      </TouchableOpacity>}
    </View>
    <NotificationModal
      visible={selection.confirmationVisible}
      title={`Delete ${selection.confirmationCount === 1 ? 'conversation' : 'conversations'}?`}
      message="These conversations will be deleted for you only. The other participants will keep their messages."
      iconName="delete-outline"
      primaryButtonText="Delete for me"
      onPrimaryPress={() => { void selection.confirmDelete(); }}
      secondaryButtonText="Cancel"
      onSecondaryPress={selection.cancelDelete}
      onRequestClose={selection.cancelDelete}
      onBackdropPress={selection.cancelDelete}
    />
  </>;
}
