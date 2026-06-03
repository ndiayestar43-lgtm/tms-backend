import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Le nom est requis' })
      .min(2, 'Le nom doit faire au moins 2 caractères')
      .max(100, 'Le nom ne peut pas dépasser 100 caractères')
      .trim(),
    email: z
      .string({ required_error: "L'email est requis" })
      .email('Email invalide')
      .toLowerCase()
      .trim(),
    phone: z
      .string({ required_error: 'Le téléphone est requis' })
      .regex(
        /^(\+221)?[0-9]{9}$/,
        'Numéro de téléphone sénégalais invalide (ex: +221771234567)'
      ),
    password: z
      .string({ required_error: 'Le mot de passe est requis' })
      .min(8, 'Le mot de passe doit faire au moins 8 caractères')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'
      ),
    address: z
      .string()
      .max(255, "L'adresse ne peut pas dépasser 255 caractères")
      .trim()
      .optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "L'email est requis" })
      .email('Email invalide')
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: 'Le mot de passe est requis' })
      .min(1, 'Le mot de passe est requis'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string({ required_error: 'Le refresh token est requis' }),
  }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string({ required_error: 'Le mot de passe actuel est requis' }),
      newPassword: z
        .string({ required_error: 'Le nouveau mot de passe est requis' })
        .min(8, 'Le mot de passe doit faire au moins 8 caractères')
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'
        ),
      confirmPassword: z.string({ required_error: 'La confirmation est requise' }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'Les mots de passe ne correspondent pas',
      path: ['confirmPassword'],
    }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).trim().optional(),
    phone: z
      .string()
      .regex(/^(\+221)?[0-9]{9}$/, 'Numéro invalide')
      .optional(),
    address: z.string().max(255).trim().optional(),
  }),
});

export const adminUpdateMemberSchema = z.object({
  params: z.object({
    id: z.string().length(24, 'ID invalide'),
  }),
  body: z.object({
    name: z.string().min(2).max(100).trim().optional(),
    phone: z.string().regex(/^(\+221)?[0-9]{9}$/).optional(),
    address: z.string().max(255).trim().optional(),
    status: z.enum(['active', 'suspended', 'expired']).optional(),
    isActive: z.boolean().optional(),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
