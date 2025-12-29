<?php
/**
 * Plugin Name: Rax Lead Management System
 * Plugin URI: https://wpmanageninja.com
 * Description: Comprehensive Lead Management System for WP Manage Ninja ecosystem
 * Version: 1.0.0
 * Author: WP Manage Ninja
 * Author URI: https://wpmanageninja.com
 * License: GPL v2 or later
 * Text Domain: rax-lms
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('RAX_LMS_VERSION', '1.0.0');
define('RAX_LMS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('RAX_LMS_PLUGIN_URL', plugin_dir_url(__FILE__));
define('RAX_LMS_PLUGIN_FILE', __FILE__);

// Include required files
require_once RAX_LMS_PLUGIN_DIR . 'includes/class-database.php';
require_once RAX_LMS_PLUGIN_DIR . 'includes/class-rest-api.php';
require_once RAX_LMS_PLUGIN_DIR . 'includes/class-admin.php';
require_once RAX_LMS_PLUGIN_DIR . 'includes/class-integrations.php';

/**
 * Main plugin class
 */
class Rax_Lead_Management {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->init_hooks();
    }
    
    private function init_hooks() {
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        
        add_action('plugins_loaded', array($this, 'load_textdomain'));
        add_action('init', array($this, 'init'));
    }
    
    public function activate() {
        Rax_LMS_Database::create_tables();
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        flush_rewrite_rules();
    }
    
    public function load_textdomain() {
        load_plugin_textdomain('rax-lms', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }
    
    public function init() {
        // Initialize components
        Rax_LMS_REST_API::get_instance();
        Rax_LMS_Admin::get_instance();
        Rax_LMS_Integrations::get_instance();
    }
}

// Initialize the plugin
Rax_Lead_Management::get_instance();

