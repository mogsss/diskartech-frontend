import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ApplicationSection from '@/components/student/application-details/ApplicationSection';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSalaryUnit } from '@/utils/jobRate';

interface EmploymentContractCardProps {
  startDate?: string;
  endDate?: string;
  workSchedule?: string;
  agreedRate?: string | number;
  salaryType?: string | null;
  contractTerms?: string;
  specialInstructions?: string;
  status?: string;
}

export default function EmploymentContractCard({
  startDate,
  endDate,
  workSchedule,
  agreedRate,
  salaryType,
  contractTerms,
  specialInstructions,
  status,
}: EmploymentContractCardProps) {
  const { isDark, colors } = useDarkMode();
  const isTerminated = status === 'terminated';
  const isAccepted = status === 'accepted';

  return (
    <ApplicationSection title="Employment contract" icon="handshake" badge={
      <View className="px-2 py-1 rounded-lg" style={{ backgroundColor: isDark ? colors.background : '#F1F5F9' }}>
        <Text className="text-[10px] font-semibold" style={{ color: colors.textSecondary }}>{isTerminated ? 'Terminated' : isAccepted ? 'Active' : 'Concluded'}</Text>
      </View>
    }>
      {/* Contract Dates & Rate */}
      <View className="flex-row gap-2.5 mb-2.5">
        <View 
          className="flex-1 rounded-2xl p-3 border"
          style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC', borderColor: colors.border }}
        >
          <Text className="text-[10px] font-semibold uppercase" style={{ color: colors.textSecondary }}>Start Date</Text>
          <Text className="text-xs font-bold mt-0.5" style={{ color: colors.text }}>{startDate || 'N/A'}</Text>
        </View>
        <View 
          className="flex-1 rounded-2xl p-3 border"
          style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC', borderColor: colors.border }}
        >
          <Text className="text-[10px] font-semibold uppercase" style={{ color: colors.textSecondary }}>Contract End / Duration</Text>
          <Text className="text-xs font-bold mt-0.5" style={{ color: colors.text }}>{endDate || 'Project-based / Ongoing'}</Text>
        </View>
      </View>

      <View className="flex-row gap-2.5 mb-3">
        <View 
          className="flex-1 rounded-2xl p-3 border"
          style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC', borderColor: colors.border }}
        >
          <Text className="text-[10px] font-semibold uppercase" style={{ color: colors.textSecondary }}>Schedule</Text>
          <Text className="text-xs font-bold mt-0.5" style={{ color: colors.text }}>{workSchedule || 'Flexible'}</Text>
        </View>
        <View 
          className="flex-1 rounded-2xl p-3 border"
          style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC', borderColor: colors.border }}
        >
          <Text className="text-[10px] font-semibold uppercase" style={{ color: colors.textSecondary }}>Agreed Rate</Text>
          <Text className="text-xs font-bold mt-0.5" style={{ color: isDark ? '#34D399' : '#047857' }}>₱{agreedRate || '0'} {getSalaryUnit(salaryType)}</Text>
        </View>
      </View>

      {/* Contract Terms & Termination Policy */}
      <View 
        className="rounded-2xl p-3 mb-3 border"
        style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC', borderColor: colors.border }}
      >
        <View className="flex-row items-center gap-1.5 mb-1">
          <MaterialIcons name="gavel" size={14} color={colors.textSecondary} />
          <Text className="text-[11px] font-bold" style={{ color: colors.text }}>Contract & Termination Terms</Text>
        </View>
        <Text className="text-xs leading-relaxed" style={{ color: colors.textSecondary }}>
          {contractTerms ||
            '• Both parties may terminate this contract with at least 3 days prior written notice.\n• Immediate termination applies in cases of misconduct or violation of agreed terms.\n• Agreed payment to be disbursed on time upon completion of assigned work.'}
        </Text>
      </View>

      {/* 1st Day Special Instructions */}
      {specialInstructions && (
        <View 
          className="rounded-2xl p-3 border"
          style={{ 
            backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : 'rgba(254, 242, 242, 0.6)',
            borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FEE2E2'
          }}
        >
          <Text className="text-[10px] font-semibold uppercase mb-0.5" style={{ color: isDark ? colors.accent : '#991B1B' }}>
            1st Day Instructions
          </Text>
          <Text className="text-xs leading-relaxed" style={{ color: isDark ? '#FECACA' : '#450A0A' }}>
            {specialInstructions}
          </Text>
        </View>
      )}
    </ApplicationSection>
  );
}
