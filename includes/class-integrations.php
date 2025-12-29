<?php
/**
 * Integrations with WP Manage Ninja products
 */

if (!defined('ABSPATH')) {
    exit;
}

class Rax_LMS_Integrations {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Fluent Forms integration
        add_action('fluentform_submission_inserted', array($this, 'handle_fluent_forms'), 10, 3);
        
        // Fluent CRM integration
        add_action('fluentcrm_contact_created', array($this, 'handle_fluent_crm'), 10, 2);
        
        // Fluent Support integration
        add_action('fluent_support_ticket_created', array($this, 'handle_fluent_support'), 10, 2);
        
        // Fluent Booking integration
        add_action('fluent_booking_booking_created', array($this, 'handle_fluent_booking'), 10, 2);
        
        // Ninja Tables integration
        add_action('ninja_tables_after_insert', array($this, 'handle_ninja_tables'), 10, 2);
        
        // WP Social Ninja integration
        add_action('wp_social_ninja_lead_created', array($this, 'handle_wp_social_ninja'), 10, 2);
    }
    
    public function handle_fluent_forms($insert_id, $form_data, $form) {
        $email = '';
        $name = '';
        $phone = '';
        
        // Try to find email field
        foreach ($form_data as $key => $value) {
            if (is_email($value)) {
                $email = $value;
            }
            if (strpos(strtolower($key), 'name') !== false || strpos(strtolower($key), 'full_name') !== false) {
                $name = $value;
            }
            if (strpos(strtolower($key), 'phone') !== false || strpos(strtolower($key), 'mobile') !== false) {
                $phone = $value;
            }
        }
        
        if (empty($email)) {
            return;
        }
        
        if (empty($name)) {
            $name = $email;
        }
        
        $this->create_lead_from_integration(array(
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'source' => 'fluent_forms',
            'metadata' => array(
                'form_id' => $form->id,
                'submission_id' => $insert_id,
                'form_data' => $form_data
            )
        ));
    }
    
    public function handle_fluent_crm($contact, $subscriber) {
        $this->create_lead_from_integration(array(
            'name' => $contact->full_name,
            'email' => $contact->email,
            'phone' => $contact->phone,
            'source' => 'fluent_crm',
            'metadata' => array(
                'contact_id' => $contact->id,
                'subscriber_id' => $subscriber->id
            )
        ));
    }
    
    public function handle_fluent_support($ticket, $customer) {
        $this->create_lead_from_integration(array(
            'name' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone ?? '',
            'source' => 'fluent_support',
            'metadata' => array(
                'ticket_id' => $ticket->id,
                'customer_id' => $customer->id
            )
        ));
    }
    
    public function handle_fluent_booking($booking, $customer) {
        $this->create_lead_from_integration(array(
            'name' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone ?? '',
            'source' => 'fluent_booking',
            'metadata' => array(
                'booking_id' => $booking->id,
                'customer_id' => $customer->id
            )
        ));
    }
    
    public function handle_ninja_tables($table_id, $data) {
        $email = '';
        $name = '';
        $phone = '';
        
        foreach ($data as $key => $value) {
            if (is_email($value)) {
                $email = $value;
            }
            if (strpos(strtolower($key), 'name') !== false) {
                $name = $value;
            }
            if (strpos(strtolower($key), 'phone') !== false) {
                $phone = $value;
            }
        }
        
        if (empty($email)) {
            return;
        }
        
        if (empty($name)) {
            $name = $email;
        }
        
        $this->create_lead_from_integration(array(
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'source' => 'ninja_tables',
            'metadata' => array(
                'table_id' => $table_id,
                'row_data' => $data
            )
        ));
    }
    
    public function handle_wp_social_ninja($lead_data, $source) {
        $this->create_lead_from_integration(array(
            'name' => $lead_data['name'] ?? '',
            'email' => $lead_data['email'] ?? '',
            'phone' => $lead_data['phone'] ?? '',
            'source' => 'wp_social_ninja',
            'metadata' => array(
                'social_source' => $source,
                'lead_data' => $lead_data
            )
        ));
    }
    
    private function create_lead_from_integration($data) {
        // Check if lead already exists
        global $wpdb;
        $table = $wpdb->prefix . 'rax_lms_leads';
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $table WHERE email = %s",
            $data['email']
        ));
        
        if ($existing) {
            // Update existing lead if needed
            Rax_LMS_Database::update_lead($existing, array(
                'metadata' => $data['metadata']
            ));
            return;
        }
        
        // Create new lead
        Rax_LMS_Database::create_lead($data);
    }
}


