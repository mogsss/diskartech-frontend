import PolicyScreen from '@/components/common/PolicyScreen';
import { TERMS_AND_CONDITIONS } from '@/data/legalPolicies';
import React from 'react';

export default function TermsAndConditionsScreen() {
  return <PolicyScreen document={TERMS_AND_CONDITIONS} icon="description" relatedPolicy={{ title: 'Privacy Policy', href: '/privacy-policy' }} />;
}
