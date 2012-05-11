/*global $, jQuery, window, document, escape, unescape, alert, self, chrome, localStorage, setTimeout */

(function($){
  "use strict";

  $.fn.serializeJSON = function() {
    var json = {};

    $.map($(this).serializeArray(), function(n, i){
      i = null;
      json[n.name] = n.value;
    });
    return json;
  };

  $.extend($.expr[':'],{
    containsExactCase: function(a,i,m){
      return $.trim(a.innerHTML) === unescape(m[3]);
    }
  });

}(jQuery));

$(function() {

  "use strict";

  var ns = {
    n           : "namespotter",
    active      : false,
    tab         : {},
    settings    : {},
    response    : { names : [] },
    scrub       : ['select', 'input', 'textearea', 'script', 'style', 'noscript', 'img']
  };

  ns.compareStringLengths = function(a, b) {
    if (a.length < b.length) { return 1;  }
    if (a.length > b.length) { return -1; }
    return 0;
  };

  ns.verbatim = function(sort) {
    var verbatim = [];

    $.each(this.response.names, function() {
      if($.inArray(this.verbatim, verbatim) === -1) { verbatim.push(this.verbatim); }
    });

    if(sort) { return verbatim.sort(this.compareStringLengths); }
    return verbatim.sort();
  };

  ns.highlight = function() {
    $('body').highlight(this.verbatim(true), { className : this.n+'-highlight', wordsOnly : true });
  };

  ns.unhighlight = function() {
    $('body').unhighlight({className: this.n+'-highlight'});
  };

  ns.i18n = function() {
    var self = this;

    $.each($("[data-"+self.n+"-i18n]"), function() {
      var message = chrome.i18n.getMessage($(this).attr("data-"+self.n+"-i18n"));
      $(this).html(message);
    });
  };

  ns.activateToolBox = function() {
    var self          = this,
        names_el      = $('#'+self.n+'-names').resizer(),
        names_el_list = $('#'+self.n+'-names-list'),
        maxZ          = Math.max.apply(null, $.map($('body *'), function(e,n) {
                          n = null;
                          if($(e).css('position') === 'absolute') {
                            return parseInt($(e).css('z-index'),10) || 100000;
                          }
                        }));

    $('#'+self.n+'-toolbox').css('z-index', maxZ+1);

    $.each(['close', 'minimize', 'maximize'], function() {
      var item = this;
      $('.'+self.n+'-'+item).click(function(e) {
        e.preventDefault();
        if(item === 'minimize') { names_el.height('36px'); names_el_list.height('0px'); }
        if(item === 'maximize') { names_el.height('400px'); names_el_list.height('436px'); }
        if(item === 'close') {
          $('#'+self.n+'-toolbox').remove();
          self.unhighlight();
          chrome.extension.sendRequest({ method : "ns_closed", tab : self.tab });
        }
      });
    });

    if(!self.settings || !self.settings.engine) {
      $('input:radio[name="engine"][value=""]').attr('checked', true);
    }

    if(self.settings) {
      $.each(self.settings, function(name, value) {
        var ele = $('form :input[name="' + name + '"]');
        $.each(ele, function() {
          if(this.type === 'checkbox' || this.type === 'radio') {
            this.checked = (this.value === value);
          } else {
            this.value = value;
          }
        });
      });
    }
  };

  ns.makeToolBox = function() {
    var toolbox = '';

    $.ajax({
      type     : "GET",
      async    : false,
      url      : chrome.extension.getURL("/toolbox.html"),
      dataType : 'html',
      success  : function(response) {
        toolbox = response;
      }
    });
    $('body').append(toolbox);
    this.activateToolBox();
  };

  ns.showSettings = function() {
    $('#'+this.n+'-names-buttons').hide();
    $('#'+this.n+'-names-list').hide();
    $('#'+this.n+'-settings').show();
  };

  ns.hideSettings = function() {
    $('#'+this.n+'-names-buttons').show();
    $('#'+this.n+'-names-list').show();
    $('#'+this.n+'-settings').hide();
  };

  ns.saveSettings = function() {
    var self = this, data = $('#'+this.n+'-settings-form').serializeJSON();

    self.showMessage('saved');
    $.each(['-config', '-names-selections'], function(){
      $('#' + self.n + this).fadeOut(3000);
    });
    $('#'+self.n+'-settings').fadeOut(3000, function(){
      chrome.extension.sendRequest({ method : "ns_saveSettings", params : data });
    });
  };

  ns.makeSelectList = function() {
    var self        = this,
        occurrences = 0,
        markup      = "",
        options     = "";

    $.each(this.verbatim(), function() {
      occurrences = $("." + self.n + "-highlight:containsExactCase('" + escape(this) + "')").length;
      markup = (occurrences > 1) ? " (" + occurrences + ")" : "";
      options += '<option value="' + this + '">' + this + markup + '</option>';
    });

    $('#' + self.n + '-names-selections select').append(options);
  };

  ns.addNames = function() {
    var self = this, list = "", encoded = "", name = "", scientific = [];

    $.each(self.response.names, function() {
      name = this.scientificName.replace(/[\[\]]/gi,"");
      if($.inArray(name, scientific) === -1) { scientific.push(name); }
    });

    $.each(scientific.sort(), function() {
      encoded = encodeURIComponent(this);
      list += '<li><input type="checkbox" id="ns-' + encoded + '" name="names[' + encoded + ']" value="' + this + '"><label for="ns-' + encoded + '">' + this + '</label></li>';
    });
    $('#'+self.n+'-names-list ul').html("").append(list);
  };

  ns.showMessage = function(key) {
    var width = $('#' + this.n + '-toolbox').width()/2 - $('#' + this.n + '-message').width()/2 - 30;

    $('#' + this.n + '-message').text(chrome.i18n.getMessage(key)).css('left', width).slideDown('slow').delay(1000).slideUp('slow');
  };

  ns.activateButtons = function() {
    var self = this, data = {}, names_list_input = $('input', '#'+self.n+'-names-list');

    $.each(['all', 'none', 'copy'], function() {
      var action = this;
      $('.' + self.n + '-select-' + action).click(function(e) {
        e.preventDefault();
        if(action === 'all') {
          $.each(names_list_input, function() {
            $(this).attr("checked", true);
          });
        }
        if(action === 'none') {
          $.each(names_list_input, function() {
            $(this).attr("checked", false);
          });
        }
        if(action === 'copy') {
          data = { names: $('#'+self.n+'-names-form').serializeArray() };
          chrome.extension.sendRequest({ method : "ns_clipBoard", params : data }, function(response) {
            if(response.message && response.message === "success") { self.showMessage('copied'); }
          });
        }
      });
    });

    $.each(['show', 'save', 'cancel'], function() {
      var action = this;
      $('.' + self.n + '-settings-' + action).click(function(e) {
        e.preventDefault();
        if(action === 'show') { self.showSettings(); }
        if(action === 'save') { self.saveSettings(); }
        if(action === 'cancel') { self.hideSettings(); }
      });
    });

  };

  ns.activateSelectList = function() {
    var self = this;

    $('.' + self.n + '-arrow').click(function(e) {
      if($('#' + self.n + '-names-selections select').val() === "") {
        e.preventDefault();
        return;
      }
    });

    $('#' + self.n + '-names-selections select').change(function() {
      var selected    = $('option:selected', this).val(),
          current     = 0,
          occurrences = $("." + self.n + "-highlight:containsExactCase('" + escape(selected) + "')");

      $("." + self.n + "-highlight").removeClass(self.n + "-selected");

      $('body').scrollTo(occurrences.eq(current).addClass(self.n + "-selected"), 0, { offset:-50 });

      $.each(['up', 'down'], function() {
        var _self = this, offset = { offset : -25 };
        $('.' + self.n + '-arrow-' + _self).unbind('click').click(function(e) {
          e.preventDefault();
          if(_self === 'up') {
            current -= 1;
            if(current < 0) { current = 0; }
          } else if (_self === 'down') {
            current += 1;
            if(current > occurrences.length - 1) {
              current = occurrences.length - 1;
              offset = {};
            }
          }
          $("." + self.n + "-highlight").removeClass(self.n + "-selected");
          $('body').scrollTo(occurrences.eq(current).addClass(self.n + "-selected"), 0, offset);
        });
      });
      
    });
  };

  ns.analytics = function(category, action, label) {
    var data = { category : category, action : action, label : label };

    chrome.extension.sendRequest({ method : "ns_analytics", params : data });
  };

  ns.getParameterByName = function(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS  = "[\\?&]" + name + "=([^&#]*)",
        regex   = new RegExp(regexS),
        results = regex.exec(this.tab.url);

    if(results === null) { return ""; }
    return decodeURIComponent(results[1].replace(/\+/g, " "));
  };

  ns.sendComplete = function(total) {
    var message = { tab : this.tab, total : total || null };

    this.active = false;
    chrome.extension.sendRequest({ method : "ns_complete", params : message });
  };

  ns.sendPage = function() {
    var self    = this,
        engine  = (self.settings && self.settings.engine) ? self.settings.engine : null,
        url     = self.tab.url,
        message = { tab : self.tab, data : { unique : true  } },
        ext     = url.split('.').pop().toLowerCase(),
        body    = "",
        cell    = "";

    self.active = true;

    if(url.indexOf("docs.google.com") !== -1 && ext === "pdf") {
      message.data.url = self.getParameterByName('url');
    } else if(ext === "pdf") {
      message.data.url = url;
    } else {
      body = $('body').clone();
      $.each(self.scrub, function() {
        body.find(this).remove();
      });
      $.each($('td', body), function() {
        cell = $(this).html();
        $(this).html(" " + cell);
      });
      message.data.input  = body.text().replace(/\s+/g, " ");
    }

    if(engine) { message.data.engine = engine; }

    $('#'+self.n+'-toolbox').remove();
    chrome.extension.sendRequest({ method : "ns_content", params : message });
  };

  ns.clearvars = function() {
    this.tab        = {};
    this.settings   = {};
    this.response   = { names : [] };
  };

  ns.cleanup = function() {
    this.clearvars();
    this.unhighlight();
  };

  ns.showWarning = function() {
    var message = chrome.i18n.getMessage("content_warning");

    alert(message);
  };

  ns.unload = function() {
    var self = this;

    $(window).bind('beforeunload', function() {
      chrome.extension.sendRequest({ method : "ns_refresh", params : { tab : self.tab }}, function(response) {
        if(response.message === "success") {
          self.tab = {};
        }
      });
    });
  };

  ns.loadListener = function() {
    var self = this;

    chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
      sender = null;
      switch(request.method) {
        case 'ns_initialize':
          self.cleanup();
          self.tab = request.params.tab;
          self.settings = request.params.settings;
          self.unload();
          try {
            if(self.active === false) { self.sendPage(); }
          } catch(err) {
            self.sendComplete();
            self.showWarning();
          }
        break;

        case 'ns_highlight':
          if(request.params && request.params.total > 0 && self.tab.id !== undefined) {
            self.response = request.params;
            try {
              self.highlight();
              self.makeToolBox();
              self.addNames();
              self.makeSelectList();
              self.activateSelectList();
              self.activateButtons();
              self.i18n();
              self.sendComplete(request.params.total);
            } catch(err) {
              self.sendComplete();
              self.showWarning();
            }
          }
        break;
      }
      sendResponse({});
    });
  };

  ns.init = function() {
    this.loadListener();
  };

  ns.init();

});