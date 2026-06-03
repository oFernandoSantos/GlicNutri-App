import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AvatarProfissional } from '../agendamento/uiAgendamento';
import { patientTheme } from '../../temas/temaVisualPaciente';
import QuadroDetalhesPerfilProfissional from './QuadroDetalhesPerfilProfissional';

const OUTLINE = '#E8ECF0';

/**
 * Card de perfil do profissional (paciente) — fundo branco, layout clean.
 */
export default function CartaoPerfilProfissionalPaciente({
  linked = false,
  linkedLabel = 'Profissional vinculado',
  name,
  specialty,
  registration,
  avatarName,
  avatarUri,
  rating,
  reviewCount,
  yearsExperience,
  bio,
  tags = [],
  detailItems = [],
}) {
  return (
    <View style={[styles.card, linked && styles.cardLinked]}>
      {linked ? (
        <View style={styles.linkedBadge}>
          <Ionicons name="checkmark-circle" size={14} color={patientTheme.colors.primaryDark} />
          <Text style={styles.linkedBadgeText}>{linkedLabel}</Text>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <AvatarProfissional name={avatarName} size={56} online imageUri={avatarUri} />
        <View style={styles.headerBody}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.specialty} numberOfLines={1}>
            {specialty}
          </Text>
          {registration ? (
            <Text style={styles.registration} numberOfLines={1}>
              {registration}
            </Text>
          ) : null}
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={12} color={patientTheme.colors.warning} />
            <Text style={styles.ratingText}>{rating}</Text>
            <Text style={styles.ratingMeta}>({reviewCount} avaliações)</Text>
            <Text style={styles.ratingDot}>·</Text>
            <Text style={styles.ratingMeta}>{yearsExperience} anos</Text>
          </View>
        </View>
      </View>

      {bio ? <Text style={styles.bio}>{bio}</Text> : null}

      {tags.length ? (
        <View style={styles.tagsRow}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {detailItems.length ? <QuadroDetalhesPerfilProfissional items={detailItems} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: patientTheme.colors.primaryDark,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  cardLinked: {
    borderWidth: 1.5,
    borderColor: patientTheme.colors.primaryDark,
  },
  linkedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F4FBF7',
    borderWidth: 1,
    borderColor: patientTheme.colors.primarySoft,
  },
  linkedBadgeText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  headerBody: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: patientTheme.colors.text,
    letterSpacing: -0.3,
  },
  specialty: {
    fontSize: 13,
    fontWeight: '600',
    color: patientTheme.colors.textMuted,
    marginTop: 2,
  },
  registration: {
    fontSize: 12,
    fontWeight: '700',
    color: patientTheme.colors.primaryDark,
    marginTop: 2,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F6F8FA',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  ratingMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: patientTheme.colors.textMuted,
  },
  ratingDot: {
    fontSize: 11,
    color: patientTheme.colors.textMuted,
  },
  bio: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: patientTheme.colors.textMuted,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: patientTheme.colors.primarySoft,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: patientTheme.colors.primaryDark,
  },
});
