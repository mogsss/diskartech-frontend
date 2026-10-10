import PolicyScreen from '@/components/common/PolicyScreen';
import { PRIVACY_POLICY } from '@/data/legalPolicies';
import React from 'react';

export default function PrivacyPolicyScreen() {
  return <PolicyScreen document={PRIVACY_POLICY} icon="security" relatedPolicy={{ title: 'Terms and Conditions', href: '/terms-and-conditions' }} showPrivacyReference />;
}
