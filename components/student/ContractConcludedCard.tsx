import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Badge from '@/components/ui/Badge';
import { formatDate } from '@/utils/helpers';

interface ContractConcludedCardProps {
  applicationId: string | number;
  status?: string;
  terminationReason?: string;
  terminatedAt?: string;
}

export default function ContractConcludedCard({
  applicationId,
  status = 'terminated',
  terminationReason,
  terminatedAt,
}: ContractConcludedCardProps) {
  const isCompleted = status === 'completed';

  return (
    <View
      className={`bg-white rounded-3xl p-5 mb-4 shadow-sm border ${
        isCompleted ? 'border-emerald-200' : 'border-red-200'
      }`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View
          className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
            isCompleted
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <MaterialIcons
            name={isCompleted ? 'check-circle' : 'cancel'}
            size={15}
            color={isCompleted ? '#059669' : '#DC2626'}
          />
          <Text
            className={`text-xs font-bold uppercase tracking-wider ${
              isCompleted ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {isCompleted ? 'Contract Completed' : 'Contract Concluded'}
          </Text>
        </View>
        <Text className="text-slate-400 text-xs font-semibold">
          ID: #{applicationId}
        </Text>
      </View>

      <Text className="text-xl font-extrabold text-slate-900 mb-1">
        {isCompleted ? 'Employment Completed' : 'Employment Concluded'}
      </Text>
      <Text className="text-slate-600 text-xs leading-5">
        {isCompleted
          ? 'This employment contract has been successfully completed. You may now request an official Certificate of Employment and rate your employer.'
          : 'This employment contract has been concluded by the employer.'}
      </Text>

      {!isCompleted && terminationReason && (
        <View className="mt-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Reason for Termination
          </Text>
          <Text className="text-xs text-slate-800 font-semibold mt-0.5 leading-relaxed">
            {terminationReason.split(':')[0].trim()}
          </Text>
        </View>
      )}

      <View className="mt-4 pt-3 border-t border-slate-100 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <MaterialIcons
            name="event"
            size={15}
            color={isCompleted ? '#059669' : '#64748B'}
          />
          <Text className="text-slate-500 text-xs font-medium">
            {isCompleted ? 'Completed: ' : 'Terminated: '}
            {formatDate(terminatedAt || new Date().toISOString())}
          </Text>
        </View>
        <Badge
          text={isCompleted ? 'Completed' : 'Closed'}
          variant={isCompleted ? 'success' : 'error'}
          size="small"
        />
      </View>
    </View>
  );
}
