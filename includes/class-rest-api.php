<?php
/**
 * REST API endpoints for Rax Lead Management System
 */

if (!defined('ABSPATH')) {
    exit;
}

class Rax_LMS_REST_API {
    
    private static $instance = null;
    private $namespace = 'rax-lms/v1';
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }
    
    public function register_routes() {
        // Leads endpoints
        register_rest_route($this->namespace, '/leads', array(
            array(
                'methods' => 'GET',
                'callback' => array($this, 'get_leads'),
                'permission_callback' => array($this, 'check_permissions')
            ),
            array(
                'methods' => 'POST',
                'callback' => array($this, 'create_lead'),
                'permission_callback' => array($this, 'check_permissions')
            )
        ));
        
        register_rest_route($this->namespace, '/leads/(?P<id>\d+)', array(
            array(
                'methods' => 'GET',
                'callback' => array($this, 'get_lead'),
                'permission_callback' => array($this, 'check_permissions')
            ),
            array(
                'methods' => 'PUT',
                'callback' => array($this, 'update_lead'),
                'permission_callback' => array($this, 'check_permissions')
            ),
            array(
                'methods' => 'DELETE',
                'callback' => array($this, 'delete_lead'),
                'permission_callback' => array($this, 'check_permissions')
            )
        ));
        
        register_rest_route($this->namespace, '/leads/bulk', array(
            'methods' => 'POST',
            'callback' => array($this, 'bulk_update_leads'),
            'permission_callback' => array($this, 'check_permissions')
        ));
        
        // Activities endpoints
        register_rest_route($this->namespace, '/leads/(?P<lead_id>\d+)/activities', array(
            array(
                'methods' => 'GET',
                'callback' => array($this, 'get_activities'),
                'permission_callback' => array($this, 'check_permissions')
            ),
            array(
                'methods' => 'POST',
                'callback' => array($this, 'create_activity'),
                'permission_callback' => array($this, 'check_permissions')
            )
        ));
        
        // Stats endpoint
        register_rest_route($this->namespace, '/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_stats'),
            'permission_callback' => array($this, 'check_permissions')
        ));
        
        // Analytics endpoints
        register_rest_route($this->namespace, '/analytics', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_analytics'),
            'permission_callback' => array($this, 'check_permissions')
        ));
        
        // Segments endpoints
        register_rest_route($this->namespace, '/segments', array(
            array(
                'methods' => 'GET',
                'callback' => array($this, 'get_segments'),
                'permission_callback' => array($this, 'check_permissions')
            ),
            array(
                'methods' => 'POST',
                'callback' => array($this, 'create_segment'),
                'permission_callback' => array($this, 'check_permissions')
            )
        ));
        
        register_rest_route($this->namespace, '/segments/(?P<id>\d+)', array(
            array(
                'methods' => 'GET',
                'callback' => array($this, 'get_segment_leads'),
                'permission_callback' => array($this, 'check_permissions')
            ),
            array(
                'methods' => 'DELETE',
                'callback' => array($this, 'delete_segment'),
                'permission_callback' => array($this, 'check_permissions')
            )
        ));
        
        // Tags endpoints
        register_rest_route($this->namespace, '/tags', array(
            array(
                'methods' => 'GET',
                'callback' => array($this, 'get_tags'),
                'permission_callback' => array($this, 'check_permissions')
            ),
            array(
                'methods' => 'POST',
                'callback' => array($this, 'create_tag'),
                'permission_callback' => array($this, 'check_permissions')
            )
        ));
        
        register_rest_route($this->namespace, '/tags/(?P<name>[a-zA-Z0-9_-]+)', array(
            array(
                'methods' => 'PUT',
                'callback' => array($this, 'update_tag'),
                'permission_callback' => array($this, 'check_permissions')
            ),
            array(
                'methods' => 'DELETE',
                'callback' => array($this, 'delete_tag'),
                'permission_callback' => array($this, 'check_permissions')
            )
        ));
        
        // Calendar endpoints
        register_rest_route($this->namespace, '/calendar', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_calendar_events'),
            'permission_callback' => array($this, 'check_permissions')
        ));
        
        // Settings endpoints
        register_rest_route($this->namespace, '/settings', array(
            array(
                'methods' => 'GET',
                'callback' => array($this, 'get_settings'),
                'permission_callback' => array($this, 'check_permissions')
            ),
            array(
                'methods' => 'PUT',
                'callback' => array($this, 'update_settings'),
                'permission_callback' => array($this, 'check_permissions')
            )
        ));
        
        // Reports endpoints
        register_rest_route($this->namespace, '/reports/(?P<type>[a-z-]+)', array(
            array(
                'methods' => 'GET',
                'callback' => array($this, 'get_report'),
                'permission_callback' => array($this, 'check_permissions')
            )
        ));
    }
    
    public function check_permissions() {
        return current_user_can('manage_options');
    }
    
    public function get_leads($request) {
        $args = array(
            'status' => $request->get_param('status'),
            'source' => $request->get_param('source'),
            'priority' => $request->get_param('priority'),
            'assigned_user' => $request->get_param('assigned_user'),
            'search' => $request->get_param('search'),
            'date_from' => $request->get_param('date_from'),
            'date_to' => $request->get_param('date_to'),
            'per_page' => $request->get_param('per_page') ?: 20,
            'page' => $request->get_param('page') ?: 1,
            'orderby' => $request->get_param('orderby') ?: 'created_at',
            'order' => $request->get_param('order') ?: 'DESC'
        );
        
        $result = Rax_LMS_Database::get_leads($args);
        
        return new WP_REST_Response($result, 200);
    }
    
    public function get_lead($request) {
        $id = intval($request->get_param('id'));
        $lead = Rax_LMS_Database::get_lead($id);
        
        if (!$lead) {
            return new WP_Error('not_found', 'Lead not found', array('status' => 404));
        }
        
        return new WP_REST_Response($lead, 200);
    }
    
    public function create_lead($request) {
        $data = $request->get_json_params();
        
        $result = Rax_LMS_Database::create_lead($data);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        // Log activity
        Rax_LMS_Database::create_activity(array(
            'lead_id' => $result,
            'type' => 'system',
            'content' => 'Lead created'
        ));
        
        $lead = Rax_LMS_Database::get_lead($result);
        return new WP_REST_Response($lead, 201);
    }
    
    public function update_lead($request) {
        $id = intval($request->get_param('id'));
        $data = $request->get_json_params();
        
        $old_lead = Rax_LMS_Database::get_lead($id);
        if (!$old_lead) {
            return new WP_Error('not_found', 'Lead not found', array('status' => 404));
        }
        
        $result = Rax_LMS_Database::update_lead($id, $data);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        // Log status changes
        if (isset($data['status']) && $data['status'] !== $old_lead['status']) {
            Rax_LMS_Database::create_activity(array(
                'lead_id' => $id,
                'type' => 'status_change',
                'content' => sprintf('Status changed from %s to %s', $old_lead['status'], $data['status'])
            ));
        }
        
        $lead = Rax_LMS_Database::get_lead($id);
        return new WP_REST_Response($lead, 200);
    }
    
    public function delete_lead($request) {
        $id = intval($request->get_param('id'));
        
        $result = Rax_LMS_Database::delete_lead($id);
        
        if (!$result) {
            return new WP_Error('delete_failed', 'Failed to delete lead', array('status' => 500));
        }
        
        return new WP_REST_Response(array('success' => true), 200);
    }
    
    public function bulk_update_leads($request) {
        $data = $request->get_json_params();
        $lead_ids = isset($data['ids']) ? array_map('intval', $data['ids']) : array();
        $updates = isset($data['updates']) ? $data['updates'] : array();
        
        if (empty($lead_ids) || empty($updates)) {
            return new WP_Error('invalid_data', 'Lead IDs and updates are required', array('status' => 400));
        }
        
        $updated = 0;
        $errors = array();
        
        foreach ($lead_ids as $lead_id) {
            $result = Rax_LMS_Database::update_lead($lead_id, $updates);
            
            if (is_wp_error($result)) {
                $errors[] = $lead_id;
            } else {
                $updated++;
                
                // Log bulk update
                if (isset($updates['status'])) {
                    Rax_LMS_Database::create_activity(array(
                        'lead_id' => $lead_id,
                        'type' => 'status_change',
                        'content' => sprintf('Status changed to %s (bulk update)', $updates['status'])
                    ));
                }
            }
        }
        
        return new WP_REST_Response(array(
            'updated' => $updated,
            'errors' => $errors
        ), 200);
    }
    
    public function get_activities($request) {
        $lead_id = intval($request->get_param('lead_id'));
        $args = array(
            'per_page' => $request->get_param('per_page') ?: 50,
            'page' => $request->get_param('page') ?: 1
        );
        
        $activities = Rax_LMS_Database::get_activities($lead_id, $args);
        
        // Add user names
        foreach ($activities as &$activity) {
            if ($activity['created_by']) {
                $user = get_userdata($activity['created_by']);
                $activity['created_by_name'] = $user ? $user->display_name : 'Unknown';
            }
        }
        
        return new WP_REST_Response($activities, 200);
    }
    
    public function create_activity($request) {
        $lead_id = intval($request->get_param('lead_id'));
        $data = $request->get_json_params();
        
        $data['lead_id'] = $lead_id;
        
        $result = Rax_LMS_Database::create_activity($data);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        $activity = Rax_LMS_Database::get_activities($lead_id, array('per_page' => 1, 'page' => 1));
        
        return new WP_REST_Response($activity[0] ?? null, 201);
    }
    
    public function get_stats($request) {
        $stats = Rax_LMS_Database::get_stats();
        return new WP_REST_Response($stats, 200);
    }
    
    public function get_analytics($request) {
        $analytics = Rax_LMS_Database::get_analytics();
        return new WP_REST_Response($analytics, 200);
    }
    
    public function get_segments($request) {
        $segments = Rax_LMS_Database::get_segments();
        return new WP_REST_Response($segments, 200);
    }
    
    public function create_segment($request) {
        $data = $request->get_json_params();
        $result = Rax_LMS_Database::create_segment($data);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return new WP_REST_Response($result, 201);
    }
    
    public function get_segment_leads($request) {
        $segment_id = intval($request->get_param('id'));
        $leads = Rax_LMS_Database::get_segment_leads($segment_id);
        return new WP_REST_Response($leads, 200);
    }
    
    public function delete_segment($request) {
        $id = intval($request->get_param('id'));
        $result = Rax_LMS_Database::delete_segment($id);
        
        if (!$result) {
            return new WP_Error('delete_failed', 'Failed to delete segment', array('status' => 500));
        }
        
        return new WP_REST_Response(array('success' => true), 200);
    }
    
    public function get_tags($request) {
        $tags = Rax_LMS_Database::get_tags();
        return new WP_REST_Response($tags, 200);
    }
    
    public function create_tag($request) {
        $data = $request->get_json_params();
        $name = isset($data['name']) ? sanitize_text_field($data['name']) : '';
        
        if (empty($name)) {
            return new WP_Error('missing_name', 'Tag name is required', array('status' => 400));
        }
        
        $result = Rax_LMS_Database::create_tag($name);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return new WP_REST_Response($result, 201);
    }
    
    public function update_tag($request) {
        $old_name = $request->get_param('name');
        $data = $request->get_json_params();
        $result = Rax_LMS_Database::update_tag($old_name, $data);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return new WP_REST_Response($result, 200);
    }
    
    public function delete_tag($request) {
        $name = $request->get_param('name');
        $result = Rax_LMS_Database::delete_tag($name);
        
        if (!$result) {
            return new WP_Error('delete_failed', 'Failed to delete tag', array('status' => 500));
        }
        
        return new WP_REST_Response(array('success' => true), 200);
    }
    
    public function get_calendar_events($request) {
        $month = $request->get_param('month');
        $year = $request->get_param('year');
        $events = Rax_LMS_Database::get_calendar_events($month, $year);
        return new WP_REST_Response($events, 200);
    }
    
    public function get_settings($request) {
        $settings = Rax_LMS_Database::get_settings();
        return new WP_REST_Response($settings, 200);
    }
    
    public function update_settings($request) {
        $data = $request->get_json_params();
        $result = Rax_LMS_Database::update_settings($data);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return new WP_REST_Response($result, 200);
    }
    
    public function get_report($request) {
        $report_type = $request->get_param('type');
        $date_from = $request->get_param('date_from');
        $date_to = $request->get_param('date_to');
        
        $valid_types = array('overview', 'performance', 'source-analysis', 'conversion', 'activity');
        
        if (!in_array($report_type, $valid_types)) {
            return new WP_Error('invalid_report_type', 'Invalid report type', array('status' => 400));
        }
        
        $report_data = Rax_LMS_Database::get_report_data($report_type, $date_from, $date_to);
        
        return new WP_REST_Response($report_data, 200);
    }
    
}

