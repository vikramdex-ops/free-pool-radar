-- Development seed (§64).
--
-- All offers are marked is_seed_data = true so the API and UI can label them.
-- The sweep replaces these on its first run; a row still flagged as seed
-- after a successful sweep is a bug worth surfacing.
--
-- Written as individual statements rather than a shared VALUES list. Postgres
-- only reports "VALUES lists must all be the same length" without naming the
-- offending row, and a wide row of 28 nullable columns is exactly the shape
-- where that happens. Per-row inserts make a mistake local and obvious.
--
-- Every figure here was read from the cited official source on
-- 28 September 2026. A value the provider does not publish is NULL, never
-- zero: the UI renders NULL as "Not publicly stated" (§9).

-- ---------------------------------------------------------------------------
-- providers
-- ---------------------------------------------------------------------------
insert into providers (name, slug, official_url, description, provider_type, country, status) values
  ('APMix','apmix','https://apmix.ai','Community events that open one enormous shared token pool on a frontier model for every account.','gateway','NL','active'),
  ('AIHubMix','aihubmix','https://aihubmix.com','OpenAI- and Anthropic-compatible gateway that subsidises a set of *-free model ids at its own cost.','gateway','US','active'),
  ('OpenRouter','openrouter','https://openrouter.ai','Model router whose :free variant costs zero per input and output token.','router','US','active'),
  ('sponsored/tokens','sponsored-tokens','https://sponsoredtokens.com','Public pool of frontier-model tokens funded by third-party sponsors.','sponsored','EE','active'),
  ('FreeTheAI','freetheai','https://freetheai.xyz','Discord-keyed public API serving donated and sponsored capacity across several upstream providers.','gateway',null,'active'),
  ('OpenCode Zen','opencode-zen','https://opencode.ai/zen','The full frontier catalogue with a subset of ids served free inside the coding agent.','gateway',null,'active'),
  ('AnyRouter','anyrouter','https://anyrouter.dev','Auto-routing gateway that prefers $0 upstream capacity before paid fallbacks.','router',null,'active'),
  ('Kilo Gateway','kilo','https://kilo.ai','Keyless per-IP gateway route over a shared pool of free model capacity.','gateway',null,'acquired'),
  ('LLM7','llm7','https://llm7.io','Key-optional donor-funded tier reaching a small set of open models.','gateway',null,'active'),
  ('Pollinations','pollinations','https://pollinations.ai','Community endpoint with an anonymous keyless text route and a Pollen-metered catalogue.','gateway','EE','active'),
  ('NVIDIA NIM','nvidia-nim','https://build.nvidia.com','Vendor-hosted open-model catalogue with a cardless prototyping rate limit.','vendor','US','active'),
  ('Groq','groq','https://console.groq.com','LPU inference at very high token rates on a cardless free plan.','vendor','US','active'),
  ('Google AI Studio','google-ai-studio','https://aistudio.google.com','Gemini models free of charge on a cardless tier, with the longest context of any first-party offer.','vendor','US','active'),
  ('Z.ai','zai','https://z.ai','GLM Flash models priced free at every token position, input and output alike.','vendor','CN','active'),
  ('Cloudflare Workers AI','cloudflare-workers-ai','https://workers.ai','Edge inference metered in neurons, with a daily free allocation.','vendor','US','active'),
  ('Hugging Face Inference','huggingface','https://huggingface.co/inference','Inference router fronting many upstream providers against a monthly credit.','router','US','active'),
  ('SambaNova','sambanova','https://cloud.sambanova.ai','RDU inference on a cardless tier defined as having no payment method linked.','vendor','US','active'),
  ('Cohere','cohere','https://cohere.com','Trial API access, explicitly restricted to non-commercial use.','vendor','CA','active'),
  ('joule','joule','https://joule.f00.sh','Community cluster of donated idle GPUs. The public pool costs no cash, only compute.','community',null,'active'),
  ('AMD Token Factory','amd-token-factory','https://developer.amd.com.cn/radeon/tokenfactory','Vendor-run free model API with both OpenAI and Anthropic dialects.','vendor',null,'active'),
  ('Tokenator','tokenator','https://tokenator.top','Free model id on a separate daily allowance from the paid key limit.','gateway',null,'active'),
  ('GitHub Models','github-models','https://github.com/marketplace/models','Retired 30 July 2026. Retained as a historical record.','vendor','US','shut_down'),
  ('Chutes','chutes','https://chutes.ai','Confidential-compute inference. Free tier retired 15 March 2026.','gateway',null,'active'),
  ('Together AI','together','https://www.together.ai','Free tier removed July 2025; a minimum credit purchase is now required.','vendor','US','active'),
  ('Vercel AI Gateway','vercel-ai-gateway','https://vercel.com/ai-gateway','Monthly gateway credit that requires a payment method before it can be spent.','router','US','active'),
  ('Cerebras','cerebras','https://cloud.cerebras.ai','API access stays inactive until a verified payment method is added.','vendor','US','active'),
  ('AI/ML API','aimlapi','https://aimlapi.com','Aggregator with a free plan and a small starter token allocation.','aggregator',null,'active'),
  ('Nebius AI Cloud','nebius','https://nebius.com','Free trial suspended 13 July 2026. Builder Program still grants expiring credit.','vendor',null,'active'),
  ('StepFun','stepfun','https://platform.stepfun.com','Free trial ended 18 July 2026. Paid only.','vendor','CN','active'),
  ('SiliconFlow','siliconflow','https://www.siliconflow.cn','Sign-up voucher plus a set of genuinely zero-cost embedding and speech models.','gateway','CN','active'),
  ('Moonshot Kimi','kimi','https://platform.kimi.com','Sign-up voucher valid three months, excluded from the newest model.','vendor','CN','active'),
  ('Novita AI','novita','https://novita.ai','Two models priced at zero in and zero out.','aggregator',null,'active'),
  ('Baidu Qianfan','baidu-qianfan','https://cloud.baidu.com/product-s/qianfan_home','Per-model token grants across seventeen models, time-boxed.','vendor','CN','active'),
  ('Alibaba Model Studio','alibaba-model-studio','https://bailian.console.aliyun.com','Per-model token grant with a ninety-day window and no identity check needed.','vendor','CN','active'),
  ('Tencent TokenHub','tencent-tokenhub','https://console.cloud.tencent.com/lkeap','A million shared tokens for a year across all language models.','vendor','CN','active'),
  ('Volcengine Ark','volcengine-ark','https://www.volcengine.com/product/ark','Per-model token grants, plus a programme that pays credit for inference data.','vendor','CN','active'),
  ('ModelScope','modelscope','https://www.modelscope.cn','Daily call allowance across a community model catalogue.','community','CN','active'),
  ('Mistral','mistral','https://console.mistral.ai','Standing free mode with hidden limits readable only in the admin panel.','vendor','FR','active'),
  ('Fireworks AI','fireworks','https://fireworks.ai','A small signup credit, cardless, on prepaid billing.','vendor','US','active')
-- The curated registry owns these fields. Re-running the seed repairs a row a
-- collector has degraded, whereas `do nothing` would leave a placeholder name
-- and a non-official URL in place forever.
on conflict (slug) do update set
  name         = excluded.name,
  official_url = excluded.official_url,
  description  = coalesce(excluded.description, providers.description),
  provider_type= coalesce(excluded.provider_type, providers.provider_type),
  country      = coalesce(excluded.country, providers.country),
  status       = excluded.status;

-- ---------------------------------------------------------------------------
-- sources — the monitoring registry (§10)
-- ---------------------------------------------------------------------------
insert into sources (provider_slug, url, source_type, priority, parser_key, is_official, interval_hours) values
  ('apmix','https://apmix.ai/event','rsc',1,'apmix.event',true,5),
  ('openrouter','https://openrouter.ai/api/v1/models','json',1,'openrouter.models',true,5),
  ('aihubmix','https://aihubmix.com/v1/models','json',1,'aihubmix.models',true,5),
  ('opencode-zen','https://opencode.ai/zen/v1/models','json',1,'zen.models',true,5),
  ('anyrouter','https://anyrouter.dev/v1/models','json',1,'anyrouter.models',true,5),
  ('kilo','https://api.kilo.ai/api/gateway/models','json',1,'kilo.models',true,5),
  ('llm7','https://api.llm7.io/v1/models','json',1,'llm7.models',true,5),
  ('pollinations','https://text.pollinations.ai/models','json',1,'pollinations.models',true,5),
  ('sponsored-tokens','https://sponsoredtokens.com/api/sponsors','json',1,'sponsoredtokens.pool',true,5),
  ('freetheai','https://api.freetheai.xyz/v1/health','json',1,'freetheai.health',true,5),
  ('joule','https://joule.f00.sh/api/pool','json',1,'joule.pool',true,5),
  ('chutes','https://chutes.ai/api/models','json',1,'chutes.catalog',true,5)
on conflict (provider_slug, url, parser_key) do nothing;

-- ---------------------------------------------------------------------------
-- live offers, one insert each
-- ---------------------------------------------------------------------------
insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, rpm, rpd, tpm, tpd, monthly_limit, monthly_unit, pool_size, pool_remaining, pool_unit, start_at, exhaustion_condition, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'gpt-6-luna-free','shared_pool','upcoming',false,false,false,true,false,true,true,60,null,null,null,null,null,10000000000,10000000000,'weighted_tokens','2026-10-02T17:00:00Z','Requests answer 403 event_ended once the pool is spent','allowed','Not publicly stated','Not publicly stated','https://apmix.ai/event','official_event_page',0.95,now(),now(),null,true from providers where slug='apmix' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, monthly_limit, monthly_unit, pool_size, pool_remaining, pool_unit, exhaustion_condition, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'Real Claude, GPT and Gemini behind the sponsored/ prefix','sponsored_inference','live',false,false,false,true,false,true,true,5,'dollars',37000000,35130000,'dollars','Pool runs to zero; requests then fall back to your own credits','allowed','Prompts are not retained and are not used for training','Not retained','https://sponsoredtokens.com/sponsors','live_api',0.92,now(),now(),now(),true from providers where slug='sponsored-tokens' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, rpm, rpd, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'49 models across 8 upstream providers','sponsored_inference','live',false,false,false,true,false,true,true,10,250,'allowed','No prompt logging; IP and request metadata logged','Operational metadata only','https://api.freetheai.xyz/v1/health','live_api',0.9,now(),now(),now(),true from providers where slug='freetheai' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'gemini-3.8-flash and nine other models','free_tier','live',false,false,false,true,false,true,false,'allowed','Free-tier prompts may be used to improve Google products','Up to 72h','https://ai.google.dev/gemini-api/docs/pricing','official_docs',0.9,now(),now(),now(),true from providers where slug='google-ai-studio' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'glm-4.7-flash, glm-4.5-flash, glm-4.6v-flash','free_tier','live',false,false,false,true,false,true,true,'Not publicly stated','Not publicly stated','Not publicly stated','https://docs.z.ai/guides/overview/pricing','official_docs',0.85,now(),now(),now(),true from providers where slug='zai' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, rpm, rpd, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,':free model ids','free_tier','live',false,false,false,true,false,true,false,20,50,'allowed','Zero prompt logging by default; provider policy still applies','Zero by default','https://openrouter.ai/docs/guides/privacy/data-collection','live_api',0.93,now(),now(),now(),true from providers where slug='openrouter' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, rpm, rpd, tpm, tpd, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'gpt-oss-120b, gpt-oss-20b, qwen3.8-27b','free_tier','live',false,false,false,true,false,true,false,30,1000,8000,200000,'allowed','No retention by default; self-serve ZDR available','Zero by default','https://console.groq.com/docs/your-data','official_docs',0.9,now(),now(),now(),true from providers where slug='groq' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, rpm, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'Nemotron 3, GLM 5.3, Kimi K3, GPT-OSS 20B and more','free_tier','live',false,false,false,true,false,true,false,40,'allowed','No statement published for the hosted catalogue','Not publicly stated','https://build.nvidia.com/llms.txt','official_docs',0.88,now(),now(),now(),true from providers where slug='nvidia-nim' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, rpm, monthly_limit, monthly_unit, exhaustion_condition, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'Llama 3.3 70B, GPT-OSS 120B, Qwen3 30B, GLM 4.7 Flash','free_tier','live',false,false,false,true,false,false,true,300,10000,'neurons','Allocation exhausted at the daily limit','allowed','Inference runs in your own account boundary','Not publicly stated','https://developers.cloudflare.com/workers-ai/platform/pricing/','official_docs',0.88,now(),now(),now(),true from providers where slug='cloudflare-workers-ai' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, rpm, token_limit, token_limit_unit, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'GLM-5.3-Flash, DeepSeek-V4-Flash-0731, minimax-m2.7','free_tier','live',false,false,false,false,true,true,false,10,500000,'tokens','unknown','Not publicly stated','Not publicly stated','https://docs.llm7.io/limits','live_api',0.8,now(),now(),now(),true from providers where slug='llm7' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, rpd, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,':free model ids and kilo-auto/free','keyless','live',false,false,false,false,true,true,false,200,'unknown','Not publicly stated','Not publicly stated','https://kilo.ai/docs/gateway/authentication','live_api',0.82,now(),now(),now(),true from providers where slug='kilo' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, is_seed_data)
-- The label must equal the model id so the sweep adopts this row instead of
-- creating a second copy of the same pool.
select id,'kimi-open','shared_pool','unverified',false,false,false,true,false,true,false,'allowed','Open source, MIT','Not applicable','https://joule.f00.sh/api/pool','live_api',0.7,now(),now(),true from providers where slug='joule' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, rpm, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'DeepSeek-V4-Flash, Qwen3.8-Flash-Next','free_tier','live',false,false,false,true,false,true,true,30,'allowed','Not publicly stated','Not publicly stated','https://developer.amd.com.cn/radeon/tokenfactory','community',0.7,now(),now(),now(),true from providers where slug='amd-token-factory' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, rpd, token_limit, token_limit_unit, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'free-glm-5.3-flash','free_tier','live',false,false,false,true,false,true,false,60,4000000,'tokens','allowed','Not publicly stated','Not publicly stated','https://tokenator.top','community',0.7,now(),now(),now(),true from providers where slug='tokenator' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, monthly_limit, monthly_unit, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'$0.10 monthly inference credit','free_credits','live',false,false,false,true,false,true,false,0.1,'dollars','allowed','Not publicly stated','Not publicly stated','https://huggingface.co/docs/inference-providers/pricing','official_docs',0.9,now(),now(),now(),true from providers where slug='huggingface' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, compatibility_anthropic, rpm, rpd, tpd, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'Meta-Llama-3.3-70B, DeepSeek-V3.1, gpt-oss-120b','free_tier','live',false,false,false,true,false,true,false,20,20,200000,'allowed','Free tier not used for training','Not publicly stated','https://docs.sambanova.ai/docs/en/models/rate-limits','official_docs',0.9,now(),now(),now(),true from providers where slug='sambanova' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, rpm, rpd, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'Command A+, Command R+, North Mini Code','free_trial','live',false,false,false,true,false,false,20,1000,'restricted','Trial keys are non-commercial by policy','Up to 72h','https://docs.cohere.com/docs/rate-limits','official_docs',0.9,now(),now(),now(),true from providers where slug='cohere' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'Mistral Large 3, Medium 3.5, Small 4, Devstral 2','free_tier','live',false,false,false,true,false,true,'restricted','Not publicly stated','Not publicly stated','https://docs.mistral.ai/admin/user-management-finops/tier','official_docs',0.85,now(),now(),now(),true from providers where slug='mistral' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, credit_amount, credit_currency, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'$1 signup credit','free_credits','live',false,false,false,true,false,true,1,'USD','allowed','Not publicly stated','Not publicly stated','https://fireworks.ai/pricing','official_docs',0.85,now(),now(),now(),true from providers where slug='fireworks' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'Ling 3.0 Flash Fin, Ling 3.0 Flash Sante','free_tier','live',false,false,false,true,false,true,'allowed','Not publicly stated','Not publicly stated','https://novita.ai/pricing','official_docs',0.85,now(),now(),now(),true from providers where slug='novita' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, credit_amount, credit_currency, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'¥15 sign-up voucher','free_credits','live',false,false,false,true,false,true,15,'CNY','allowed','Not publicly stated','Not publicly stated','https://www.kimi.com/help/kimi-api/api-free-trial','official_docs',0.8,now(),now(),now(),true from providers where slug='kimi' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, token_limit, token_limit_unit, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'bge-m3 embeddings, SenseVoiceSmall speech','free_tier','live',false,false,false,true,false,true,0,'tokens','allowed','Not publicly stated','Not publicly stated','https://www.siliconflow.cn/pricing','official_docs',0.75,now(),now(),now(),true from providers where slug='siliconflow' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, keyless, compatibility_openai, token_limit, token_limit_unit, commercial_use, data_policy, retention_policy, official_evidence_url, verification_level, confidence, first_verified_at, last_verified_at, last_seen_live_at, is_seed_data)
select id,'Qwen3, DeepSeek-R1, GLM','free_tier','live',false,false,false,true,false,true,2000,'requests','restricted','Not publicly stated','Not publicly stated','https://www.modelscope.cn/docs/','official_docs',0.8,now(),now(),now(),true from providers where slug='modelscope' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

-- ---------------------------------------------------------------------------
-- ended and gated offers. Retained permanently (§16, §24, §67).
-- ---------------------------------------------------------------------------
insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, rpm, rpd, ended_at, first_verified_at, last_verified_at, official_evidence_url, verification_level, confidence, is_seed_data)
select id,'Catalog and inference API','free_tier','ended',false,false,false,true,null,null,'2026-07-30T00:00:00Z',now(),'2026-07-30T00:00:00Z','https://docs.github.com/en/github-models','official_docs',1.0,true from providers where slug='github-models' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, ended_at, first_verified_at, last_verified_at, official_evidence_url, verification_level, confidence, is_seed_data)
select id,'Free tier, 200 req/day','free_tier','ended',true,true,false,true,'2026-03-15T00:00:00Z',now(),'2026-03-15T00:00:00Z','https://chutes.ai/news/community-announcement-february','official_announcement',0.95,true from providers where slug='chutes' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, ended_at, first_verified_at, last_verified_at, official_evidence_url, verification_level, confidence, is_seed_data)
select id,'Free tier','free_tier','ended',true,true,false,true,'2025-07-01T00:00:00Z',now(),'2025-07-01T00:00:00Z','https://docs.together.ai/docs/billing-credits','official_docs',0.95,true from providers where slug='together' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, credit_amount, credit_currency, ended_at, first_verified_at, last_verified_at, official_evidence_url, verification_level, confidence, is_seed_data)
select id,'$5 monthly gateway credit','free_credits','ended',true,true,false,true,5,'USD','2026-01-12T00:00:00Z',now(),'2026-01-12T00:00:00Z','https://vercel.com/docs/ai-gateway/faq','official_docs',0.9,true from providers where slug='vercel-ai-gateway' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, credit_amount, credit_currency, rpm, ended_at, first_verified_at, last_verified_at, official_evidence_url, verification_level, confidence, is_seed_data)
select id,'Free inference, card-gated','free_tier','ended',true,true,false,true,5,'USD',5,'2026-01-01T00:00:00Z',now(),'2026-01-01T00:00:00Z','https://inference-docs.cerebras.ai/support/rate-limits','official_docs',0.95,true from providers where slug='cerebras' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, ended_at, first_verified_at, last_verified_at, official_evidence_url, verification_level, confidence, is_seed_data)
select id,'Free trial','free_tier','ended',true,true,false,true,'2026-07-18T00:00:00Z',now(),'2026-07-18T00:00:00Z','https://platform.stepfun.com/docs','official_docs',0.85,true from providers where slug='stepfun' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

insert into offers (provider_id, model_label, offer_type, status, card_required, payment_required, access_requires_subscription, api_key_required, credit_amount, credit_currency, ended_at, first_verified_at, last_verified_at, official_evidence_url, verification_level, confidence, is_seed_data)
select id,'Free trial programme','free_tier','ended',false,false,false,true,25,'USD','2026-07-13T00:00:00Z',now(),'2026-07-13T00:00:00Z','https://docs.nebius.com/signup-billing/free-trial','official_docs',0.9,true from providers where slug='nebius' on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

-- ---------------------------------------------------------------------------
-- events (§7.4)
-- ---------------------------------------------------------------------------
insert into events (provider_id, name, slug, description, status, start_at, pool_size, pool_remaining, unit, models, eligibility, requirements, exhaustion_condition, official_url, announced_at, last_verified_at)
select id,'Community event — shared token pool','apmix-community-event','One shared pool, every account on any plan, first come first served until it is gone.','upcoming','2026-10-02T17:00:00Z',10000000000,10000000000,'weighted_tokens',array['gpt-6-luna-free'],'Any account — free, Starter, Pro or Max','API key required. No payment method.','Requests answer 403 event_ended once the pool is spent','https://apmix.ai/event',now(),now()
from providers where slug='apmix'
on conflict (slug) do nothing;

insert into events (provider_id, name, slug, description, status, pool_size, pool_remaining, unit, models, eligibility, requirements, exhaustion_condition, official_url, last_verified_at)
select p.id,'Public sponsor pool','sponsored-tokens-public-pool','Sponsors fund one shared pool; every account draws from it at pool prices.','live',37000000,35130000,'dollars',array[]::text[],'Any account. Referral tier gates the more expensive models.','API key required. No payment method needed.','Pool drains to zero; requests then fall back to your own credits','https://sponsoredtokens.com/sponsors',now()
from providers p where p.slug='sponsored-tokens'
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- historical changes (§64)
-- ---------------------------------------------------------------------------
insert into changes (provider_id, change_type, field, old_value, new_value, detected_at, source_url, evidence, severity)
select id,'free_tier_ended','status','live','ended','2026-07-30T00:00:00Z','https://docs.github.com/en/github-models','GitHub documentation states the service was fully retired on 30 July 2026','critical' from providers where slug='github-models';

insert into changes (provider_id, change_type, field, old_value, new_value, detected_at, source_url, evidence, severity)
select id,'free_tier_ended','status','live','ended','2026-03-15T00:00:00Z','https://chutes.ai/news/community-announcement-february','The 200 req/day non-TEE quota ran to 15 March 2026, then the plan was retired','critical' from providers where slug='chutes';

insert into changes (provider_id, change_type, field, old_value, new_value, detected_at, source_url, evidence, severity)
select id,'free_tier_ended','status','live','ended','2025-07-01T00:00:00Z','https://docs.together.ai/docs/billing-credits','Docs state a minimum $5 credit purchase is required to access the API','critical' from providers where slug='together';

insert into changes (provider_id, change_type, field, old_value, new_value, detected_at, source_url, evidence, severity)
select id,'card_required','card_required','false','true','2026-01-12T00:00:00Z','https://vercel.com/docs/ai-gateway/faq','A 403 customer_verification_required response means a payment method must be added before free credits can be spent','critical' from providers where slug='vercel-ai-gateway';

insert into changes (provider_id, change_type, field, old_value, new_value, detected_at, source_url, evidence, severity)
select id,'card_required','card_required','false','true','2026-01-01T00:00:00Z','https://inference-docs.cerebras.ai/support/rate-limits','Docs state playground and API access remain inactive until a verified payment method is added','critical' from providers where slug='cerebras';

insert into changes (provider_id, change_type, field, old_value, new_value, detected_at, source_url, evidence, severity)
select id,'quota_decreased','rpd',null,'50','2025-09-01T00:00:00Z','https://openrouter.ai/docs/api-reference/limits','Unfunded accounts are capped at 50 requests/day; 1,000/day requires $10 of lifetime credits','warning' from providers where slug='openrouter';

-- ---------------------------------------------------------------------------
-- discovery queue (§52)
-- ---------------------------------------------------------------------------
insert into discovery_candidates (url, provider_guess, note, discovered_from, status, is_seed_data) values
  ('https://cline.bot/desktop','Cline','Desktop keyless provider serving proprietary Kimi K3, DeepSeek V4.1 Flash and GLM 5.3 Flash. No public API base URL documented.','Developer review','pending',true),
  ('https://freebuff.com','Freebuff','Unmetered GLM-5.3-Flash funded by ads. Privacy policy permits prompt analysis for ad personalisation.','Developer review','investigating',true),
  ('https://sensenova.cn/token-plan','SenseNova','Vendor token plan reporting GLM-5.2 free during a public beta at 500 calls per 5 hours.','Developer review','pending',true),
  ('https://api.tokenrouter.com','TokenRouter','Reports z-ai/glm-5.3-free at zero cost in and out. Do not confuse with tokenrouter.me.','Developer review','pending',true),
  ('https://peezy.p0.systems/go','Peezy','Reports deepseek-v4-flash-0731 at roughly 500 requests/day.','Developer review','pending',true);

-- ---------------------------------------------------------------------------
-- source conflict (§54) — both readings stored, neither chosen
-- ---------------------------------------------------------------------------
insert into source_conflicts (provider_id, field, value_a, source_a, value_b, source_b)
select id,'requests/day','50','https://openrouter.ai/docs/api-reference/limits — unfunded account','1,000','https://openrouter.ai/docs/api-reference/limits — after $10 lifetime credits'
from providers where slug='openrouter';

insert into source_conflicts (provider_id, field, value_a, source_a, value_b, source_b)
select id,'free-tier rate limit','not published','https://ai.google.dev/gemini-api/docs/rate-limits','20–1,500 requests/day','Third-party trackers only; Google no longer publishes per-model figures'
from providers where slug='google-ai-studio';
