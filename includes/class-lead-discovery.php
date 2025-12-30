<?php
/**
 * Lead Discovery Engine for Rax Lead Management System
 * Handles automated lead discovery from various sources
 */

if (!defined('ABSPATH')) {
    exit;
}

class Rax_LMS_Lead_Discovery {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Initialize discovery tables
        add_action('init', array($this, 'create_tables'));
    }
    
    /**
     * Create database tables for lead discovery
     */
    public function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        $table_prefix = $wpdb->prefix . 'rax_lms_';
        
        // Discovered leads table
        $discovered_leads_table = $table_prefix . 'discovered_leads';
        $discovered_leads_sql = "CREATE TABLE IF NOT EXISTS $discovered_leads_table (
            id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            name varchar(255) DEFAULT NULL,
            email varchar(255) DEFAULT NULL,
            phone varchar(50) DEFAULT NULL,
            company varchar(255) DEFAULT NULL,
            website varchar(255) DEFAULT NULL,
            location varchar(255) DEFAULT NULL,
            title varchar(255) DEFAULT NULL,
            source_url text DEFAULT NULL,
            source_type varchar(100) DEFAULT NULL,
            discovery_status varchar(50) DEFAULT 'pending',
            confidence_score int(11) DEFAULT 0,
            raw_data longtext DEFAULT NULL,
            metadata longtext DEFAULT NULL,
            imported_lead_id bigint(20) UNSIGNED DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY email (email),
            KEY discovery_status (discovery_status),
            KEY source_type (source_type),
            KEY created_at (created_at)
        ) $charset_collate;";
        
        // Discovery sources table
        $discovery_sources_table = $table_prefix . 'discovery_sources';
        $discovery_sources_sql = "CREATE TABLE IF NOT EXISTS $discovery_sources_table (
            id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            source_type varchar(100) NOT NULL,
            source_url text NOT NULL,
            is_active tinyint(1) DEFAULT 1,
            crawl_frequency varchar(50) DEFAULT 'daily',
            last_crawled datetime DEFAULT NULL,
            next_crawl datetime DEFAULT NULL,
            crawl_settings longtext DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY is_active (is_active),
            KEY next_crawl (next_crawl)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($discovered_leads_sql);
        dbDelta($discovery_sources_sql);
    }
    
    /**
     * Discover leads from a source
     */
    public static function discover_leads($source_id, $options = array()) {
        global $wpdb;
        
        $sources_table = $wpdb->prefix . 'rax_lms_discovery_sources';
        $discovered_table = $wpdb->prefix . 'rax_lms_discovered_leads';
        
        // Get source configuration
        $source = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $sources_table WHERE id = %d AND is_active = 1",
            $source_id
        ), ARRAY_A);
        
        if (!$source) {
            return new WP_Error('source_not_found', 'Source not found or inactive');
        }
        
        $source_type = $source['source_type'];
        $source_url = $source['source_url'];
        $crawl_settings = !empty($source['crawl_settings']) ? json_decode($source['crawl_settings'], true) : array();
        
        $discovered_count = 0;
        $errors = array();
        
        // Discover based on source type
        switch ($source_type) {
            case 'website':
                $result = self::discover_from_website($source_url, $crawl_settings);
                break;
            case 'directory':
                $result = self::discover_from_directory($source_url, $crawl_settings);
                break;
            case 'social_media':
                $result = self::discover_from_social_media($source_url, $crawl_settings);
                break;
            case 'api':
                $result = self::discover_from_api($source_url, $crawl_settings);
                break;
            default:
                return new WP_Error('invalid_source_type', 'Invalid source type');
        }
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        // Save discovered leads
        foreach ($result['leads'] as $lead_data) {
            // Check if lead already exists
            $existing = $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM $discovered_table WHERE email = %s AND source_url = %s",
                $lead_data['email'],
                $source_url
            ));
            
            if ($existing) {
                continue; // Skip duplicates
            }
            
            // Calculate confidence score
            $confidence = self::calculate_confidence_score($lead_data);
            
            $insert_data = array(
                'name' => sanitize_text_field($lead_data['name'] ?? ''),
                'email' => sanitize_email($lead_data['email'] ?? ''),
                'phone' => sanitize_text_field($lead_data['phone'] ?? ''),
                'company' => sanitize_text_field($lead_data['company'] ?? ''),
                'website' => esc_url_raw($lead_data['website'] ?? ''),
                'location' => sanitize_text_field($lead_data['location'] ?? ''),
                'title' => sanitize_text_field($lead_data['title'] ?? ''),
                'source_url' => esc_url_raw($source_url),
                'source_type' => sanitize_text_field($source_type),
                'discovery_status' => 'pending',
                'confidence_score' => $confidence,
                'raw_data' => json_encode($lead_data),
                'metadata' => json_encode(array(
                    'discovered_at' => current_time('mysql'),
                    'source_id' => $source_id
                ))
            );
            
            $wpdb->insert($discovered_table, $insert_data);
            $discovered_count++;
        }
        
        // Update source last crawled time
        $wpdb->update(
            $sources_table,
            array(
                'last_crawled' => current_time('mysql'),
                'next_crawl' => self::calculate_next_crawl($source['crawl_frequency'])
            ),
            array('id' => $source_id)
        );
        
        return array(
            'success' => true,
            'discovered' => $discovered_count,
            'source_id' => $source_id
        );
    }
    
    /**
     * Discover leads from a website
     */
    private static function discover_from_website($url, $settings = array()) {
        $leads = array();
        
        // Use WordPress HTTP API to fetch the page
        $response = wp_remote_get($url, array(
            'timeout' => 30,
            'user-agent' => 'Mozilla/5.0 (compatible; RaxLMS/1.0; +https://example.com)',
            'sslverify' => false
        ));
        
        if (is_wp_error($response)) {
            return $response;
        }
        
        $body = wp_remote_retrieve_body($response);
        $html = $body;
        
        // Extract emails using regex
        preg_match_all('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $html, $email_matches);
        
        // Extract phone numbers
        preg_match_all('/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/', $html, $phone_matches);
        
        // Extract names (basic pattern matching)
        preg_match_all('/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i', $html, $name_matches);
        
        // Combine extracted data into leads
        $emails = array_unique($email_matches[0] ?? array());
        $phones = array_unique($phone_matches[0] ?? array());
        $names = array_slice($name_matches[1] ?? array(), 0, min(count($emails), 10));
        
        foreach ($emails as $index => $email) {
            $lead = array(
                'email' => $email,
                'name' => isset($names[$index]) ? trim(strip_tags($names[$index])) : '',
                'phone' => isset($phones[$index]) ? $phones[$index] : '',
                'website' => $url
            );
            
            // Extract company name from URL or page title
            $domain = parse_url($url, PHP_URL_HOST);
            $lead['company'] = $domain ? str_replace('www.', '', $domain) : '';
            
            $leads[] = $lead;
        }
        
        return array('leads' => $leads);
    }
    
    /**
     * Discover leads from a directory listing
     */
    private static function discover_from_directory($url, $settings = array()) {
        // Similar to website discovery but with directory-specific parsing
        return self::discover_from_website($url, $settings);
    }
    
    /**
     * Discover leads from social media
     */
    private static function discover_from_social_media($url, $settings = array()) {
        // Placeholder for social media discovery
        // This would require API keys for platforms like LinkedIn, Twitter, etc.
        return array('leads' => array());
    }
    
    /**
     * Discover leads from an API endpoint
     */
    private static function discover_from_api($url, $settings = array()) {
        $api_key = $settings['api_key'] ?? '';
        $headers = array();
        
        if ($api_key) {
            $headers['Authorization'] = 'Bearer ' . $api_key;
        }
        
        $response = wp_remote_get($url, array(
            'timeout' => 30,
            'headers' => $headers,
            'sslverify' => false
        ));
        
        if (is_wp_error($response)) {
            return $response;
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (!$data) {
            return new WP_Error('invalid_api_response', 'Invalid API response');
        }
        
        // Parse API response into leads format
        $leads = array();
        $items = $data['results'] ?? $data['data'] ?? $data['items'] ?? array();
        
        foreach ($items as $item) {
            $lead = array(
                'name' => $item['name'] ?? $item['full_name'] ?? '',
                'email' => $item['email'] ?? '',
                'phone' => $item['phone'] ?? $item['phone_number'] ?? '',
                'company' => $item['company'] ?? $item['company_name'] ?? '',
                'website' => $item['website'] ?? $item['url'] ?? '',
                'location' => $item['location'] ?? $item['address'] ?? '',
                'title' => $item['title'] ?? $item['job_title'] ?? ''
            );
            
            if (!empty($lead['email'])) {
                $leads[] = $lead;
            }
        }
        
        return array('leads' => $leads);
    }
    
    /**
     * Calculate confidence score for a discovered lead
     */
    private static function calculate_confidence_score($lead_data) {
        $score = 0;
        
        // Email presence: +40 points
        if (!empty($lead_data['email'])) {
            $score += 40;
            // Valid email format: +10 points
            if (is_email($lead_data['email'])) {
                $score += 10;
            }
        }
        
        // Name presence: +20 points
        if (!empty($lead_data['name'])) {
            $score += 20;
        }
        
        // Company presence: +15 points
        if (!empty($lead_data['company'])) {
            $score += 15;
        }
        
        // Phone presence: +10 points
        if (!empty($lead_data['phone'])) {
            $score += 10;
        }
        
        // Website presence: +5 points
        if (!empty($lead_data['website'])) {
            $score += 5;
        }
        
        return min($score, 100); // Cap at 100
    }
    
    /**
     * Calculate next crawl time based on frequency
     */
    private static function calculate_next_crawl($frequency) {
        $now = current_time('mysql');
        $timestamp = strtotime($now);
        
        switch ($frequency) {
            case 'hourly':
                return date('Y-m-d H:i:s', $timestamp + HOUR_IN_SECONDS);
            case 'daily':
                return date('Y-m-d H:i:s', $timestamp + DAY_IN_SECONDS);
            case 'weekly':
                return date('Y-m-d H:i:s', $timestamp + WEEK_IN_SECONDS);
            case 'monthly':
                return date('Y-m-d H:i:s', $timestamp + (30 * DAY_IN_SECONDS));
            default:
                return date('Y-m-d H:i:s', $timestamp + DAY_IN_SECONDS);
        }
    }
    
    /**
     * Get discovered leads
     */
    public static function get_discovered_leads($args = array()) {
        global $wpdb;
        $table = $wpdb->prefix . 'rax_lms_discovered_leads';
        
        $defaults = array(
            'status' => '',
            'source_type' => '',
            'per_page' => 20,
            'page' => 1,
            'orderby' => 'created_at',
            'order' => 'DESC'
        );
        
        $args = wp_parse_args($args, $defaults);
        
        $where = array('1=1');
        $where_values = array();
        
        if (!empty($args['status'])) {
            $where[] = 'discovery_status = %s';
            $where_values[] = $args['status'];
        }
        
        if (!empty($args['source_type'])) {
            $where[] = 'source_type = %s';
            $where_values[] = $args['source_type'];
        }
        
        $where_clause = implode(' AND ', $where);
        $orderby = sanitize_sql_orderby($args['orderby'] . ' ' . $args['order']);
        
        $offset = ($args['page'] - 1) * $args['per_page'];
        $limit = intval($args['per_page']);
        
        $query = "SELECT * FROM $table WHERE $where_clause ORDER BY $orderby LIMIT %d OFFSET %d";
        $query_values = array_merge($where_values, array($limit, $offset));
        
        if (!empty($where_values)) {
            $leads = $wpdb->get_results($wpdb->prepare($query, $query_values), ARRAY_A);
        } else {
            $leads = $wpdb->get_results($wpdb->prepare($query, $limit, $offset), ARRAY_A);
        }
        
        // Get total count
        $count_query = "SELECT COUNT(*) FROM $table WHERE $where_clause";
        if (!empty($where_values)) {
            $total = $wpdb->get_var($wpdb->prepare($count_query, $where_values));
        } else {
            $total = $wpdb->get_var($count_query);
        }
        
        return array(
            'leads' => $leads,
            'total' => intval($total),
            'page' => $args['page'],
            'per_page' => $args['per_page']
        );
    }
    
    /**
     * Get discovery sources
     */
    public static function get_discovery_sources($active_only = false) {
        global $wpdb;
        $table = $wpdb->prefix . 'rax_lms_discovery_sources';
        
        $where = $active_only ? 'WHERE is_active = 1' : '';
        $sources = $wpdb->get_results("SELECT * FROM $table $where ORDER BY created_at DESC", ARRAY_A);
        
        foreach ($sources as &$source) {
            $source['crawl_settings'] = !empty($source['crawl_settings']) ? json_decode($source['crawl_settings'], true) : array();
        }
        
        return $sources;
    }
    
    /**
     * Create a discovery source
     */
    public static function create_discovery_source($data) {
        global $wpdb;
        $table = $wpdb->prefix . 'rax_lms_discovery_sources';
        
        // Ensure table exists (tables are created on init, but ensure they exist)
        $table_exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table));
        if (!$table_exists) {
            $instance = self::get_instance();
            $instance->create_tables();
        }
        
        // Validate required fields
        if (empty($data['name'])) {
            return new WP_Error('missing_name', 'Source name is required', array('status' => 400));
        }
        
        if (empty($data['source_type'])) {
            return new WP_Error('missing_source_type', 'Source type is required', array('status' => 400));
        }
        
        if (empty($data['source_url'])) {
            return new WP_Error('missing_source_url', 'Source URL is required', array('status' => 400));
        }
        
        $insert_data = array(
            'name' => sanitize_text_field($data['name']),
            'source_type' => sanitize_text_field($data['source_type']),
            'source_url' => esc_url_raw($data['source_url']),
            'is_active' => isset($data['is_active']) ? intval($data['is_active']) : 1,
            'crawl_frequency' => sanitize_text_field($data['crawl_frequency'] ?? 'daily'),
            'crawl_settings' => json_encode($data['crawl_settings'] ?? array()),
            'next_crawl' => self::calculate_next_crawl($data['crawl_frequency'] ?? 'daily')
        );
        
        $result = $wpdb->insert($table, $insert_data);
        
        if ($result === false) {
            // Get the last database error
            $error_message = $wpdb->last_error ? $wpdb->last_error : 'Database insert failed';
            return new WP_Error('db_error', 'Failed to create discovery source: ' . $error_message, array('status' => 500));
        }
        
        if ($result) {
            return $wpdb->insert_id;
        }
        
        return new WP_Error('db_error', 'Failed to create discovery source', array('status' => 500));
    }
    
    /**
     * Import a discovered lead into the main leads table
     */
    public static function import_discovered_lead($discovered_lead_id, $lead_data = array()) {
        global $wpdb;
        
        $discovered_table = $wpdb->prefix . 'rax_lms_discovered_leads';
        $leads_table = $wpdb->prefix . 'rax_lms_leads';
        
        // Get discovered lead
        $discovered = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $discovered_table WHERE id = %d",
            $discovered_lead_id
        ), ARRAY_A);
        
        if (!$discovered) {
            return new WP_Error('lead_not_found', 'Discovered lead not found');
        }
        
        // Prepare lead data
        $defaults = array(
            'name' => $discovered['name'],
            'email' => $discovered['email'],
            'phone' => $discovered['phone'],
            'source' => 'discovery',
            'status' => 'new',
            'priority' => 'medium',
            'assigned_user' => null,
            'tags' => array(),
            'metadata' => array(
                'company' => $discovered['company'],
                'website' => $discovered['website'],
                'location' => $discovered['location'],
                'title' => $discovered['title'],
                'discovered_lead_id' => $discovered_lead_id
            )
        );
        
        $lead_data = wp_parse_args($lead_data, $defaults);
        
        // Create lead using existing database method
        $lead_id = Rax_LMS_Database::create_lead($lead_data);
        
        if (is_wp_error($lead_id)) {
            return $lead_id;
        }
        
        // Update discovered lead status
        $wpdb->update(
            $discovered_table,
            array(
                'discovery_status' => 'imported',
                'imported_lead_id' => $lead_id
            ),
            array('id' => $discovered_lead_id)
        );
        
        return $lead_id;
    }
}

