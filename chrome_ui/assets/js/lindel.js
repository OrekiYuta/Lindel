$(document).ready(function() {
    function normalizeUrl(rawUrl) {
        try {
            const url = new URL(rawUrl);
            url.hash = "";
            return url.href;
        } catch (e) {
            return rawUrl;
        }
    }

    function openOrFocusTab(targetUrl) {
        const normalizedTarget = normalizeUrl(targetUrl);

        chrome.tabs.query({}, function(tabs) {
            const existingTab = tabs.find(function(tab) {
                return tab.url && normalizeUrl(tab.url) === normalizedTarget;
            });

            if (existingTab && existingTab.id !== undefined) {
                chrome.tabs.update(existingTab.id, { active: true });
                if (existingTab.windowId !== undefined) {
                    chrome.windows.update(existingTab.windowId, { focused: true });
                }
                return;
            }

            chrome.tabs.create({ url: targetUrl });
        });
    }

    const observer = lozad();
    observer.observe();

    $(document).on('click', '.has-sub', function(){
        var _this = $(this);
        if(!$(this).hasClass('expanded')) {
            setTimeout(function(){ _this.find('ul').attr("style","") }, 300);
        } else {
            $('.has-sub ul').each(function(id,ele){
                var _that = $(this)
                if(_this.find('ul')[0] != ele) {
                    setTimeout(function(){ _that.attr("style","") }, 300);
                }
            })
        }
    });

    $('.user-info-menu .hidden-sm').click(function(){
        if($('.sidebar-menu').hasClass('collapsed')) {
            $('.has-sub.expanded > ul').attr("style","")
        } else {
            $('.has-sub.expanded > ul').show()
        }
    });

    $("#main-menu li ul li").click(function() {
        $(this).siblings('li').removeClass('active');
        $(this).addClass('active');
    });

    $("a.smooth").click(function(ev) {
        ev.preventDefault();
        public_vars.$mainMenu.add(public_vars.$sidebarProfile).toggleClass('mobile-is-visible');
        ps_destroy();
        $("html, body").animate({
            scrollTop: $($(this).attr("href")).offset().top - 30
        }, {duration: 500, easing: "swing"});
    });

    // -----------------------------
    // ADD RANDOM SVG ICONS
    // -----------------------------
    const svgListUrl = chrome.runtime.getURL("assets/json/svg-icons.json");
    $.getJSON(svgListUrl, function(svgList) {
    $(".random-icon").each(function() {
            const fixedIcon = $(this).data("icon");
            if (fixedIcon) {
                $(this).html('<img src="' + chrome.runtime.getURL(fixedIcon) + '" alt="icon" class="random-svg">');
                return;
            }

            var randomSvg = svgList[Math.floor(Math.random() * svgList.length)];
            $(this).html('<img src="' + chrome.runtime.getURL(randomSvg) + '" alt="icon" class="random-svg">');
        });
    });

    // open page
    $(document).on("click", ".xe-widget[data-page]", function() {
      const page = $(this).data("page");
      if (page) {
        const url = chrome.runtime.getURL(page);
        openOrFocusTab(url);
      }
    });

    // open external URL
    $(document).on("click", ".xe-widget[data-url]", function() {
      const url = $(this).data("url");
      if (url) {
        openOrFocusTab(url);
      }
    });

});


