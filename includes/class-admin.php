<?php
/**
 * Admin interface for Rax Lead Management System
 */

if (!defined('ABSPATH')) {
    exit;
}

class Rax_LMS_Admin {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_assets'));
    }
    
    public function add_admin_menu() {
        add_menu_page(
            __('Lead Management', 'rax-lms'),
            __('Lead Management', 'rax-lms'),
            'manage_options',
            'rax-lead-management',
            array($this, 'render_admin_page'),
            'dashicons-groups',
            30
        );
    }
    
    public function enqueue_assets($hook) {
        if (strpos($hook, 'rax-lead-management') === false) {
            return;
        }
        
        // Enqueue Recharts library
        wp_enqueue_script(
            'recharts',
            'https://unpkg.com/recharts@2.10.3/umd/Recharts.js',
            array(),
            '2.10.3',
            false
        );
        
        // Enqueue CSS
        wp_enqueue_style(
            'rax-lms-admin',
            RAX_LMS_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            RAX_LMS_VERSION
        );
        
        // Enqueue JS
        wp_enqueue_script(
            'rax-lms-admin',
            RAX_LMS_PLUGIN_URL . 'assets/js/admin.js',
            array('recharts'),
            RAX_LMS_VERSION,
            true
        );
        
        // Get current user role
        $current_user = wp_get_current_user();
        $user_roles = $current_user->roles;
        $is_admin = in_array('administrator', $user_roles) || current_user_can('manage_options');
        
        // Localize script
        wp_localize_script('rax-lms-admin', 'raxLMS', array(
            'apiUrl' => rest_url('rax-lms/v1/'),
            'nonce' => wp_create_nonce('wp_rest'),
            'currentUser' => get_current_user_id(),
            'userRole' => !empty($user_roles) ? $user_roles[0] : 'subscriber',
            'isAdmin' => $is_admin,
            'users' => $this->get_users_list()
        ));
    }
    
    private function get_users_list() {
        $users = get_users(array('fields' => array('ID', 'display_name')));
        $list = array();
        foreach ($users as $user) {
            $list[] = array(
                'id' => $user->ID,
                'name' => $user->display_name
            );
        }
        return $list;
    }
    
    public function render_admin_page() {
        ?>
        <div class="wrap rax-lms-admin">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <div id="rax-lms-app"></div>
        </div>
        <?php
    }
}

