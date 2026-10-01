import React, { useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface AddSkillModalProps {
  visible: boolean;
  onClose: () => void;
  onAddSkill: (skill: string) => void;
}

export default function AddSkillModal({ visible, onClose, onAddSkill }: AddSkillModalProps) {
  const [newSkill, setNewSkill] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center bg-black/50 p-6">
        <View className="bg-white rounded-3xl p-6 shadow-lg">
          <Text className="text-lg font-bold text-slate-900 mb-2">Add New Skill</Text>
          <Text className="text-xs text-slate-400 mb-4">Type a skill you want to showcase to employers.</Text>
          
          <View className="border border-gray-200 rounded-2xl px-4 py-3 bg-gray-50 mb-6">
            <TextInput 
              placeholder="e.g., Graphic Design, Baking"
              value={newSkill}
              onChangeText={setNewSkill}
              className="text-base text-slate-900"
              autoFocus={true}
            />
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity 
              onPress={() => {
                setNewSkill('');
                onClose();
              }}
              className="flex-1 py-3.5 items-center rounded-xl bg-gray-100"
            >
              <Text className="font-semibold text-slate-600">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                if (newSkill.trim()) {
                  onAddSkill(newSkill.trim());
                  setNewSkill('');
                  onClose();
                }
              }}
              className="flex-1 py-3.5 items-center rounded-xl bg-red-600 shadow-sm"
            >
              <Text className="font-semibold text-white">Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}