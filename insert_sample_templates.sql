-- Insert sample templates for PodcastFlow Pro organization
-- Using admin@podcastflow.pro user

-- Create sample templates
INSERT INTO org_podcastflow_pro."ProposalTemplate" (id, name, description, "createdBy") VALUES
('tmpl_starter_pack', 'Starter Campaign Template', 'Perfect for new advertisers looking to test podcast advertising with a modest budget', 'cmd2qff240004og5y1f5msy5g'),
('tmpl_premium_multi', 'Premium Multi-Show Template', 'High-impact campaign across multiple premium shows for maximum reach', 'cmd2qff240004og5y1f5msy5g'),
('tmpl_tech_focused', 'Tech Industry Focus', 'Optimized for technology companies targeting tech-savvy audiences', 'cmd2qff240004og5y1f5msy5g'),
('tmpl_weekly_consistent', 'Weekly Consistency Template', 'Maintains consistent presence with weekly ad placements', 'cmd2qff240004og5y1f5msy5g'),
('tmpl_launch_blitz', 'Product Launch Blitz', 'Concentrated campaign for product launches with heavy initial coverage', 'cmd2qff240004og5y1f5msy5g');

-- Add template items for starter pack
INSERT INTO org_podcastflow_pro."ProposalTemplateItem" (id, "templateId", "placementType", "slotCount", "budgetPercentage", "priority") VALUES
('tmpl_item_sp1', 'tmpl_starter_pack', 'mid-roll', 10, 60.00, 1),
('tmpl_item_sp2', 'tmpl_starter_pack', 'pre-roll', 5, 25.00, 2),
('tmpl_item_sp3', 'tmpl_starter_pack', 'post-roll', 5, 15.00, 3);

-- Add template items for premium multi-show
INSERT INTO org_podcastflow_pro."ProposalTemplateItem" (id, "templateId", "placementType", "slotCount", "budgetPercentage", "priority", "weeklyDistribution") VALUES
('tmpl_item_pm1', 'tmpl_premium_multi', 'pre-roll', 20, 35.00, 1, '{"monday": 4, "wednesday": 4, "friday": 4, "sunday": 8}'),
('tmpl_item_pm2', 'tmpl_premium_multi', 'mid-roll', 30, 50.00, 2, '{"tuesday": 6, "thursday": 6, "saturday": 6, "sunday": 12}'),
('tmpl_item_pm3', 'tmpl_premium_multi', 'post-roll', 10, 15.00, 3, '{"friday": 5, "sunday": 5}');

-- Add template items for tech focused
INSERT INTO org_podcastflow_pro."ProposalTemplateItem" (id, "templateId", "placementType", "slotCount", "budgetPercentage", "priority") VALUES
('tmpl_item_tf1', 'tmpl_tech_focused', 'mid-roll', 25, 70.00, 1),
('tmpl_item_tf2', 'tmpl_tech_focused', 'pre-roll', 10, 30.00, 2);

-- Add template items for weekly consistent
INSERT INTO org_podcastflow_pro."ProposalTemplateItem" (id, "templateId", "placementType", "slotCount", "budgetPercentage", "priority", "weeklyDistribution") VALUES
('tmpl_item_wc1', 'tmpl_weekly_consistent', 'mid-roll', 12, 100.00, 1, '{"monday": 2, "wednesday": 2, "friday": 2, "tuesday": 2, "thursday": 2, "saturday": 1, "sunday": 1}');

-- Add template items for launch blitz
INSERT INTO org_podcastflow_pro."ProposalTemplateItem" (id, "templateId", "placementType", "slotCount", "budgetPercentage", "priority", "weeklyDistribution") VALUES
('tmpl_item_lb1', 'tmpl_launch_blitz', 'pre-roll', 30, 40.00, 1, '{"week1": 20, "week2": 10}'),
('tmpl_item_lb2', 'tmpl_launch_blitz', 'mid-roll', 40, 50.00, 2, '{"week1": 25, "week2": 15}'),
('tmpl_item_lb3', 'tmpl_launch_blitz', 'post-roll', 20, 10.00, 3, '{"week1": 15, "week2": 5}');

-- Add filters for tech focused template
INSERT INTO org_podcastflow_pro."ProposalTemplateFilter" (id, "templateId", "filterType", "filterValue") VALUES
('tmpl_filter_tf1', 'tmpl_tech_focused', 'category', '{"values": ["technology", "business"]}'),
('tmpl_filter_tf2', 'tmpl_tech_focused', 'audience_size', '{"min": 10000, "max": 100000}'),
('tmpl_filter_tf3', 'tmpl_tech_focused', 'price_range', '{"min": 200, "max": 1000}');

-- Add filters for premium multi-show template
INSERT INTO org_podcastflow_pro."ProposalTemplateFilter" (id, "templateId", "filterType", "filterValue") VALUES
('tmpl_filter_pm1', 'tmpl_premium_multi', 'audience_size', '{"min": 50000}'),
('tmpl_filter_pm2', 'tmpl_premium_multi', 'show_count', '{"min": 3, "max": 10}');

-- Add filters for starter pack
INSERT INTO org_podcastflow_pro."ProposalTemplateFilter" (id, "templateId", "filterType", "filterValue") VALUES
('tmpl_filter_sp1', 'tmpl_starter_pack', 'price_range', '{"max": 500}'),
('tmpl_filter_sp2', 'tmpl_starter_pack', 'show_count', '{"min": 1, "max": 3}');