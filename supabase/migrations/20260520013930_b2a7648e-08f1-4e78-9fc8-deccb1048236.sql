
REVOKE EXECUTE ON FUNCTION public.award_referral_bonus(UUID, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_referral_code() FROM PUBLIC, anon, authenticated;
